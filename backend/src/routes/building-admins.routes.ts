import { Router } from "express";
import { z } from "zod";
import { findCondominiumById } from "../db/condominiums";
import { addBuildingAdmin, listBuildingAdmins, removeBuildingAdmin, toApiBuildingAdmin } from "../db/residency";
import { findUserByEmail } from "../db/users";
import { requireAdmin } from "../middleware/auth";
import { notFound } from "../lib/http-error";

// Platform admins nominate building admins, who review the proofs of
// residency of people signing up to their condominium.
export const buildingAdminsRouter = Router();

buildingAdminsRouter.use(requireAdmin);

buildingAdminsRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await listBuildingAdmins();
    res.json(rows.map(toApiBuildingAdmin));
  } catch (err) {
    next(err);
  }
});

const addSchema = z.object({ email: z.email(), condominiumId: z.uuid() });

// Nominates an existing account; the person has to sign up first. They don't
// have to live in the condominium (e.g. a property manager).
buildingAdminsRouter.post("/", async (req, res, next) => {
  try {
    const { email, condominiumId } = addSchema.parse(req.body);
    const condominium = await findCondominiumById(condominiumId);
    if (!condominium) throw notFound("condominium_not_found");
    const user = await findUserByEmail(email);
    if (!user) throw notFound("building_admin_email_not_found");
    const row = await addBuildingAdmin(user.id, condominium.id, req.userId!);
    res.status(201).json(toApiBuildingAdmin(row));
  } catch (err) {
    next(err);
  }
});

buildingAdminsRouter.delete("/:condominiumId/:userId", async (req, res, next) => {
  try {
    const removed = await removeBuildingAdmin(req.params.userId as string, req.params.condominiumId as string);
    if (!removed) throw notFound("building_admin_not_found");
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
