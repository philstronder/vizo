import { Router } from "express";
import { z } from "zod";
import { findUserByEmail, listAdmins, setUserAdminById, toPublicUser } from "../db/users";
import { requireAdmin } from "../middleware/auth";
import { badRequest, notFound } from "../lib/http-error";

// Admins manage the admin list themselves. The first admin is created with
// `npm run user:make-admin`.
export const adminsRouter = Router();

adminsRouter.use(requireAdmin);

adminsRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await listAdmins();
    res.json(rows.map(toPublicUser));
  } catch (err) {
    next(err);
  }
});

const addAdminSchema = z.object({ email: z.email() });

// Promotes an existing account; the person has to sign up first.
adminsRouter.post("/", async (req, res, next) => {
  try {
    const { email } = addAdminSchema.parse(req.body);
    const user = await findUserByEmail(email);
    if (!user) throw notFound("admin_email_not_found");
    const updated = await setUserAdminById(user.id, true);
    res.status(201).json(toPublicUser(updated!));
  } catch (err) {
    next(err);
  }
});

adminsRouter.delete("/:id", async (req, res, next) => {
  try {
    const userId = req.params.id as string;
    // Admins can't demote themselves, so there's always at least one admin left.
    if (userId === req.userId) throw badRequest("cannot_remove_own_admin");
    const updated = await setUserAdminById(userId, false);
    if (!updated) throw notFound("user_not_found");
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
