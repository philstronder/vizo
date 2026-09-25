import { Router } from "express";
import {
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  toApiNotification,
} from "../db/notifications";
import { requireAuth } from "../middleware/auth";
import { notFound } from "../lib/http-error";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const rows = await listNotificationsForUser(req.userId!);
    res.json(rows.map(toApiNotification));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.patch("/read-all", async (req, res, next) => {
  try {
    await markAllNotificationsRead(req.userId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

notificationsRouter.patch("/:id/read", async (req, res, next) => {
  try {
    const updated = await markNotificationRead(req.params.id, req.userId!);
    if (!updated) throw notFound("Notification not found");
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
