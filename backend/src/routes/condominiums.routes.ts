import { Router } from "express";
import {
  createCondominium,
  deleteCondominium,
  listCondominiums,
  toApiCondominium,
} from "../db/condominiums";
import { requireAdmin } from "../middleware/auth";
import { conflict, notFound } from "../lib/http-error";
import { condominiumSchema } from "../lib/schemas";

// The condominiums residents can pick at sign-up. Anyone can read the list
// (the sign-up form is public); only admins change it.
export const condominiumsRouter = Router();

condominiumsRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await listCondominiums();
    res.json(rows.map(toApiCondominium));
  } catch (err) {
    next(err);
  }
});

condominiumsRouter.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { name, address } = condominiumSchema.parse(req.body);
    const row = await createCondominium(name, address);
    if (!row) throw conflict("condominium_exists");
    res.status(201).json(toApiCondominium(row));
  } catch (err) {
    next(err);
  }
});

condominiumsRouter.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const deleted = await deleteCondominium(req.params.id as string);
    if (!deleted) throw notFound("condominium_not_found");
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
