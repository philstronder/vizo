import { Router, type Response } from "express";
import { z } from "zod";
import { createUser, findUserByEmail, findUserById, toPublicUser, updateUser } from "../db/users";
import { hashPassword, verifyPassword } from "../lib/password";
import { AUTH_COOKIE_MAX_AGE_MS, AUTH_COOKIE_NAME, signAuthToken } from "../lib/jwt";
import { conflict, notFound, unauthorized } from "../lib/http-error";
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

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  unitNumber: z.string().trim().min(1, "Unit number is required"),
  buildingName: z.string().trim().min(1, "Building name is required"),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const existing = await findUserByEmail(input.email);
    if (existing) throw conflict("An account with this email already exists");

    const passwordHash = await hashPassword(input.password);
    const user = await createUser({
      name: input.name,
      email: input.email,
      passwordHash,
      buildingName: input.buildingName,
      unitNumber: input.unitNumber,
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

const updateMeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  buildingName: z.string().trim().min(1, "Building name is required"),
  unitNumber: z.string().trim().min(1, "Unit number is required"),
});

authRouter.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const input = updateMeSchema.parse(req.body);
    const user = await updateUser(req.userId!, input);
    if (!user) throw notFound("User not found");
    res.json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
});
