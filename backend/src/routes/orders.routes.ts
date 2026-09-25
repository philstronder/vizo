import { Router } from "express";
import { z } from "zod";
import { checkoutListingTx, findOrderById, listOrdersForUser, toApiOrder } from "../db/orders";
import { findListingById } from "../db/listings";
import { createNotification } from "../db/notifications";
import { requireAuth } from "../middleware/auth";
import { badRequest, notFound } from "../lib/http-error";

export const ordersRouter = Router();

ordersRouter.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const rows = await listOrdersForUser(req.userId!);
    res.json(rows.map(toApiOrder));
  } catch (err) {
    next(err);
  }
});

const checkoutSchema = z.object({
  listingId: z.string().min(1),
  pickupLocation: z.string().trim().min(1).optional(),
  pickupTime: z.string().trim().optional(),
});

ordersRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const input = checkoutSchema.parse(req.body);
    const result = await checkoutListingTx({
      listingId: input.listingId,
      buyerId: req.userId!,
      pickupLocation: input.pickupLocation,
      pickupTime: input.pickupTime,
    });
    if (!result.ok) throw badRequest(result.reason);

    const listing = await findListingById(input.listingId);
    if (listing) {
      await createNotification({
        userId: listing.seller_id,
        type: "sold",
        title: `${listing.title} sold!`,
        body: `Your item was purchased.`,
        href: "/orders",
      });
    }

    const order = await findOrderById(result.orderId);
    if (!order) throw notFound("Order not found");
    res.status(201).json(toApiOrder(order));
  } catch (err) {
    next(err);
  }
});
