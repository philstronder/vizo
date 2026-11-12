import { Router } from "express";
import { z } from "zod";
import { getWallet, withdrawCredits } from "../db/credits";
import { requireAuth } from "../middleware/auth";
import { badRequest } from "../lib/http-error";

export const walletRouter = Router();

walletRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    res.json(await getWallet(req.userId!));
  } catch (err) {
    next(err);
  }
});

const withdrawSchema = z.object({
  amount: z
    .number()
    .positive()
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Use at most two decimal places"),
  pixKey: z.string().trim().min(1).max(140),
});

walletRouter.post("/withdraw", requireAuth, async (req, res, next) => {
  try {
    const input = withdrawSchema.parse(req.body);
    const result = await withdrawCredits({ userId: req.userId!, ...input });
    if (!result.ok) throw badRequest(result.reason);
    res.status(201).json(await getWallet(req.userId!));
  } catch (err) {
    next(err);
  }
});
