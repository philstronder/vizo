import { Router } from "express";
import { z } from "zod";
import {
  createStore,
  deleteStore,
  findStoreById,
  listStores,
  toApiStore,
  updateStore,
} from "../db/stores";
import { requireAdmin } from "../middleware/auth";
import { notFound } from "../lib/http-error";

export const storesRouter = Router();

// Only admins see the full list of stores. Viewers reach a single store
// through its QR code, so GET /:id stays public.
storesRouter.get("/", requireAdmin, async (_req, res, next) => {
  try {
    const rows = await listStores();
    res.json(rows.map(toApiStore));
  } catch (err) {
    next(err);
  }
});

storesRouter.get("/:id", async (req, res, next) => {
  try {
    const store = await findStoreById(req.params.id as string);
    if (!store) throw notFound("Store not found");
    res.json(toApiStore(store));
  } catch (err) {
    next(err);
  }
});

const storeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().max(2000).default(""),
});

storesRouter.post("/", requireAdmin, async (req, res, next) => {
  try {
    const input = storeSchema.parse(req.body);
    const store = await createStore(input, req.userId!);
    res.status(201).json(toApiStore(store));
  } catch (err) {
    next(err);
  }
});

storesRouter.patch("/:id", requireAdmin, async (req, res, next) => {
  try {
    const input = storeSchema.parse(req.body);
    const store = await updateStore(req.params.id as string, input);
    if (!store) throw notFound("Store not found");
    res.json(toApiStore(store));
  } catch (err) {
    next(err);
  }
});

storesRouter.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const deleted = await deleteStore(req.params.id as string);
    if (!deleted) throw notFound("Store not found");
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
