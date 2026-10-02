import { Router } from "express";
import { z } from "zod";
import { checkoutListingTx, completeOrder, findOrderById, reviewOrder, listOrdersForUser, toApiOrder } from "../db/orders";
import { findListingById } from "../db/listings";
import { createNotification } from "../db/notifications";
import { requireAuth } from "../middleware/auth";
import { HttpError, badRequest, notFound } from "../lib/http-error";

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

ordersRouter.patch("/:id/complete", requireAuth, async (req, res, next) => {
  try {
    const orderId = req.params.id as string;
    const result = await completeOrder(orderId, req.userId!);
    if (!result.ok) throw new HttpError(result.status, result.reason);

    const order = await findOrderById(orderId);
    if (!order) throw notFound("Order not found");

    // Let whoever didn't mark it know the handoff was recorded.
    const markedByBuyer = order.buyer_id === req.userId;
    await createNotification({
      userId: markedByBuyer ? order.seller_id : order.buyer_id,
      type: "order_completed",
      title: `${order.listing_title} delivered`,
      body: `${markedByBuyer ? order.buyer_name : order.seller_name} marked this order as delivered.`,
      href: "/orders",
    });

    res.json(toApiOrder(order));
  } catch (err) {
    next(err);
  }
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

ordersRouter.post("/:id/review", requireAuth, async (req, res, next) => {
  try {
    const orderId = req.params.id as string;
    const input = reviewSchema.parse(req.body);
    const result = await reviewOrder({
      orderId,
      userId: req.userId!,
      rating: input.rating,
      comment: input.comment || undefined,
    });
    if (!result.ok) throw new HttpError(result.status, result.reason);

    const order = await findOrderById(orderId);
    if (!order) throw notFound("Order not found");
    res.status(201).json(toApiOrder(order));
  } catch (err) {
    next(err);
  }
});
