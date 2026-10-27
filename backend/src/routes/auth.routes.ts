import { Router, type Response } from "express";
import { z } from "zod";
import { createUser, findUserByEmail, findUserById, sameBuilding, toPublicUser, updateUser } from "../db/users";
import { hashPassword, verifyPassword } from "../lib/password";
import { AUTH_COOKIE_MAX_AGE_MS, AUTH_COOKIE_NAME, signAuthToken } from "../lib/jwt";
import { findCondominiumByName } from "../db/condominiums";
import { badRequest, conflict, notFound, unauthorized } from "../lib/http-error";
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

const deliveryAddressSchema = z.object({
  postalCode: z.string().trim().min(1, "Postal code is required"),
  street: z.string().trim().min(1, "Street is required"),
  number: z.string().trim().min(1, "Number is required"),
  complement: z.string().trim().optional(),
  district: z.string().trim().min(1, "District is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
});

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
    buildingName: z.string().trim().min(1, "Building name is required"),
    buildingBlock: z.string().trim().optional(),
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
    if (existing) throw conflict("An account with this email already exists");

    // Residents pick from the admin-maintained list; store its exact name so
    // everyone in the community shows the same spelling.
    let buildingName: string | undefined;
    if (input.accountType === "resident") {
      const condominium = await findCondominiumByName(input.buildingName);
      if (!condominium) throw badRequest("Choose a condominium from the list");
      buildingName = condominium.name;
    }

    const passwordHash = await hashPassword(input.password);
    const user = await createUser({
      name: input.name,
      email: input.email,
      passwordHash,
      ...(input.accountType === "viewer"
        ? { phone: input.phone, deliveryAddress: input.deliveryAddress }
        : { buildingName, buildingBlock: input.buildingBlock, unitNumber: input.unitNumber }),
    });

    setAuthCookie(res, user.id);
    res.status(201).json(toPublicUser(user));
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
    if (!user) throw unauthorized("Invalid email or password");

    const valid = await verifyPassword(input.password, user.password_hash);
    if (!valid) throw unauthorized("Invalid email or password");

    setAuthCookie(res, user.id);
    res.json(toPublicUser(user));
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
    if (!user) throw notFound("User not found");
    res.json(toPublicUser(user));
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
    phone: phoneSchema.optional(),
    deliveryAddress: deliveryAddressSchema.optional(),
  })
  .refine((data) => (data.buildingName === undefined) === (data.unitNumber === undefined), {
    message: "Building name and unit number go together",
    path: ["unitNumber"],
  });

authRouter.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const input = updateMeSchema.parse(req.body);
    // Communities are matched by condominium name, so it has to come from the
    // admin list (stored with the list's spelling). Keeping the current one is
    // always allowed, even if admins have since removed it from the list.
    if (input.buildingName !== undefined) {
      const current = await findUserById(req.userId!);
      if (!current) throw notFound("User not found");
      if (!sameBuilding(current.building_name, input.buildingName)) {
        const condominium = await findCondominiumByName(input.buildingName);
        if (!condominium) throw badRequest("Choose a condominium from the list");
        input.buildingName = condominium.name;
      } else {
        input.buildingName = current.building_name!;
      }
    }
    const user = await updateUser(req.userId!, input);
    if (!user) throw notFound("User not found");
    res.json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
});
