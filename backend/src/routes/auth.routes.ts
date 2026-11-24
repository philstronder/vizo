import { Router, type Response } from "express";
import { z } from "zod";
import { createUser, findUserByEmail, findUserById, sameBuilding, updateUser } from "../db/users";
import { resubmitResidencyProof } from "../db/residency";
import { hashPassword, verifyPassword } from "../lib/password";
import { AUTH_COOKIE_MAX_AGE_MS, AUTH_COOKIE_NAME, signAuthToken } from "../lib/jwt";
import { createCondominium, findCondominiumByName } from "../db/condominiums";
import { condominiumSchema, deliveryAddressSchema, proofPhotoSchema } from "../lib/schemas";
import { badRequest, conflict, notFound, unauthorized } from "../lib/http-error";
import { notifyResidencySubmitted, toSessionUser } from "../lib/residency";
import { requireAuth } from "../middleware/auth";
import { env } from "../lib/env";

export const authRouter = Router();

const cookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: "lax" as const,
  maxAge: AUTH_COOKIE_MAX_AGE_MS,
  path: "/",
};

function setAuthCookie(res: Response, userId: string) {
  res.cookie(AUTH_COOKIE_NAME, signAuthToken({ userId }), cookieOptions);
}

const phoneSchema = z.string().trim().min(8, "Phone is required");

// Building residents join their building's community; TV store viewers
// (accountType "viewer") only shop in TV stores, so they give a phone and a
// delivery address instead of a building.
const registerSchema = z.discriminatedUnion("accountType", [
  z.object({
    accountType: z.literal("resident"),
    name: z.string().trim().min(1, "Name is required"),
    email: z.email(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    unitNumber: z.string().trim().min(1, "Unit number is required"),
    // Either a condominium from the list, or one to add to it.
    buildingName: z.string().trim().min(1, "Building name is required").optional(),
    newCondominium: condominiumSchema.optional(),
    buildingBlock: z.string().trim().optional(),
    // Reviewed by the condominium's building admins before the resident can
    // use their community.
    proofPhoto: proofPhotoSchema,
  }),
  z.object({
    accountType: z.literal("viewer"),
    name: z.string().trim().min(1, "Name is required"),
    email: z.email(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    phone: phoneSchema,
    deliveryAddress: deliveryAddressSchema,
  }),
]);

authRouter.post("/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse({ accountType: "resident", ...req.body });
    const existing = await findUserByEmail(input.email);
    if (existing) throw conflict("email_taken");

    // Residents pick from the admin-maintained list, or add their condominium
    // when it's missing. Store the list's exact name so everyone in the
    // community shows the same spelling.
    let buildingName: string | undefined;
    if (input.accountType === "resident") {
      if (input.newCondominium) {
        const { name, address } = input.newCondominium;
        const created = await createCondominium(name, address);
        if (!created) throw conflict("condominium_exists_choose");
        buildingName = created.name;
      } else {
        const condominium = input.buildingName ? await findCondominiumByName(input.buildingName) : null;
        if (!condominium) throw badRequest("choose_condominium");
        buildingName = condominium.name;
      }
    }

    const passwordHash = await hashPassword(input.password);
    const user = await createUser({
      name: input.name,
      email: input.email,
      passwordHash,
      ...(input.accountType === "viewer"
        ? { phone: input.phone, deliveryAddress: input.deliveryAddress }
        : {
            buildingName,
            buildingBlock: input.buildingBlock,
            unitNumber: input.unitNumber,
            proofPhoto: input.proofPhoto,
          }),
    });
    if (input.accountType === "resident") await notifyResidencySubmitted(user);

    setAuthCookie(res, user.id);
    res.status(201).json(await toSessionUser(user));
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const user = await findUserByEmail(input.email);
    if (!user) throw unauthorized("invalid_credentials");

    const valid = await verifyPassword(input.password, user.password_hash);
    if (!valid) throw unauthorized("invalid_credentials");

    setAuthCookie(res, user.id);
    res.json(await toSessionUser(user));
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await findUserById(req.userId!);
    if (!user) throw notFound("user_not_found");
    res.json(await toSessionUser(user));
  } catch (err) {
    next(err);
  }
});

// Omitted fields keep their saved value. A building and unit go together, so
// a viewer account can join a community but nobody can leave theirs.
const updateMeSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    buildingName: z.string().trim().min(1, "Building name is required").optional(),
    unitNumber: z.string().trim().min(1, "Unit number is required").optional(),
    // Empty clears it; not every condominium has blocks.
    buildingBlock: z.string().trim().optional(),
    phone: phoneSchema.optional(),
    deliveryAddress: deliveryAddressSchema.optional(),
    // Required when joining or moving to another building.
    proofPhoto: proofPhotoSchema.optional(),
  })
  .refine((data) => (data.buildingName === undefined) === (data.unitNumber === undefined), {
    message: "Building name and unit number go together",
    path: ["unitNumber"],
  });

authRouter.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const { proofPhoto, ...input } = updateMeSchema.parse(req.body);
    // Communities are matched by condominium name, so it has to come from the
    // admin list (stored with the list's spelling). Keeping the current one is
    // always allowed, even if admins have since removed it from the list.
    // Joining or moving to another building needs a new proof of residency.
    let changingBuilding = false;
    if (input.buildingName !== undefined) {
      const current = await findUserById(req.userId!);
      if (!current) throw notFound("user_not_found");
      if (!sameBuilding(current.building_name, input.buildingName)) {
        const condominium = await findCondominiumByName(input.buildingName);
        if (!condominium) throw badRequest("choose_condominium");
        if (!proofPhoto) throw badRequest("residency_proof_required");
        input.buildingName = condominium.name;
        changingBuilding = true;
      } else {
        input.buildingName = current.building_name!;
      }
    }
    const user = await updateUser(req.userId!, { ...input, proofPhoto: changingBuilding ? proofPhoto : undefined });
    if (!user) throw notFound("user_not_found");
    if (changingBuilding) await notifyResidencySubmitted(user);
    res.json(await toSessionUser(user));
  } catch (err) {
    next(err);
  }
});

// Sends a new proof of residency after a rejection, or replaces the one
// waiting for review.
authRouter.put("/me/residency-proof", requireAuth, async (req, res, next) => {
  try {
    const { proofPhoto } = z.object({ proofPhoto: proofPhotoSchema }).parse(req.body);
    const user = await resubmitResidencyProof(req.userId!, proofPhoto);
    if (!user) {
      const current = await findUserById(req.userId!);
      if (!current) throw notFound("user_not_found");
      throw badRequest(current.building_name === null ? "tv_account_no_community" : "residency_already_verified");
    }
    await notifyResidencySubmitted(user);
    res.json(await toSessionUser(user));
  } catch (err) {
    next(err);
  }
});
