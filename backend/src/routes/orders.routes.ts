import { Router } from "express";
import { z } from "zod";
import {
  acceptMeetup,
  cancelOrder,
  checkoutListingTx,
  confirmDelivery,
  findOrderById,
  listOrdersForUser,
  proposeMeetup,
  reviewOrder,
  toApiOrder,
  type OrderRow,
} from "../db/orders";
import { findListingById } from "../db/listings";
import { createNotification } from "../db/notifications";
import { createOrderMessage, listOrderMessages, toApiOrderMessage } from "../db/order-messages";
import { requireAuth } from "../middleware/auth";
import { findViewableListing } from "../lib/listing-access";
import { HttpError, badRequest, conflict, forbidden, notFound } from "../lib/http-error";

export const ordersRouter = Router();

ordersRouter.get("/mine", requireAuth, async (req, res, next) => {
  try {
    const rows = await listOrdersForUser(req.userId!);
    res.json(rows.map(toApiOrder));
  } catch (err) {
    next(err);
  }
});

// A meetup has to be in the future (with a minute of slack for clock skew).
const meetupAtSchema = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .refine((date) => date.getTime() > Date.now() - 60_000, "Pick a time in the future");

const checkoutSchema = z.object({
  listingId: z.string().min(1),
  pickupLocation: z.string().trim().min(1).optional(),
  meetupAt: meetupAtSchema.optional(),
  useCredits: z.boolean().optional(),
});

// Who isn't userId on this order, for "let the other side know" notifications.
function counterpart(order: OrderRow, userId: string) {
  const byBuyer = order.buyer_id === userId;
  return {
    actorName: byBuyer ? order.buyer_name : order.seller_name,
    otherId: byBuyer ? order.seller_id : order.buyer_id,
  };
}

ordersRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const input = checkoutSchema.parse(req.body);
    // Buyers can only check out store products or their own building's listings.
    await findViewableListing(input.listingId, req.userId);
    const result = await checkoutListingTx({
      listingId: input.listingId,
      buyerId: req.userId!,
      pickupLocation: input.pickupLocation,
      meetupAt: input.meetupAt,
      useCredits: input.useCredits,
    });
    if (!result.ok) throw badRequest(result.reason);

    const listing = await findListingById(input.listingId);
    if (listing) {
      await createNotification({
        userId: listing.seller_id,
        type: "sold",
        title: `${listing.title} sold!`,
        body: listing.store_id
          ? "Your item was purchased."
          : "Your item was purchased and the payment is held by VIZO. Review the buyer's suggested meetup time.",
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

// The buyer confirms they received the item, or the seller that they handed it over.
ordersRouter.patch("/:id/complete", requireAuth, async (req, res, next) => {
  try {
    const result = await confirmDelivery(req.params.id as string, req.userId!);
    if (!result.ok) throw new HttpError(result.status, result.reason);
    const { order, value } = result;
    const { actorName, otherId } = counterpart(order, req.userId!);

    if (!value.completed) {
      await createNotification({
        userId: otherId,
        type: "delivery_confirmed",
        title: `${order.listing_title}: confirm the handoff`,
        body: `${actorName} confirmed the handoff. Confirm it too to complete the order.`,
        href: "/orders",
      });
    } else {
      await createNotification({
        userId: otherId,
        type: "order_completed",
        title: `${order.listing_title} delivered`,
        body: `${actorName} marked this order as delivered.`,
        href: "/orders",
      });
    }
    if (value.releasedAmount > 0) {
      await createNotification({
        userId: order.seller_id,
        type: "payment_released",
        title: "Payment released",
        body: `${value.releasedAmount.toFixed(2)} in credits from ${order.listing_title} were added to your wallet.`,
        href: "/wallet",
      });
    }

    res.json(toApiOrder(order));
  } catch (err) {
    next(err);
  }
});

ordersRouter.patch("/:id/meetup", requireAuth, async (req, res, next) => {
  try {
    const { meetupAt } = z.object({ meetupAt: meetupAtSchema }).parse(req.body);
    const result = await proposeMeetup(req.params.id as string, req.userId!, meetupAt);
    if (!result.ok) throw new HttpError(result.status, result.reason);
    const { actorName, otherId } = counterpart(result.order, req.userId!);
    await createNotification({
      userId: otherId,
      type: "meetup_proposed",
      title: `New meetup time for ${result.order.listing_title}`,
      body: `${actorName} suggested another time to meet. Accept it or suggest a different one.`,
      href: "/orders",
    });
    res.json(toApiOrder(result.order));
  } catch (err) {
    next(err);
  }
});

ordersRouter.post("/:id/meetup/accept", requireAuth, async (req, res, next) => {
  try {
    const result = await acceptMeetup(req.params.id as string, req.userId!);
    if (!result.ok) throw new HttpError(result.status, result.reason);
    const { actorName, otherId } = counterpart(result.order, req.userId!);
    await createNotification({
      userId: otherId,
      type: "meetup_confirmed",
      title: `Meetup confirmed for ${result.order.listing_title}`,
      body: `${actorName} accepted the meetup time.`,
      href: "/orders",
    });
    res.json(toApiOrder(result.order));
  } catch (err) {
    next(err);
  }
});

ordersRouter.post("/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const result = await cancelOrder(req.params.id as string, req.userId!);
    if (!result.ok) throw new HttpError(result.status, result.reason);
    const { actorName, otherId } = counterpart(result.order, req.userId!);
    await createNotification({
      userId: otherId,
      type: "order_cancelled",
      title: `${result.order.listing_title} order cancelled`,
      body: result.value.cancelledByBuyer
        ? `${actorName} cancelled the order. Your item is back on sale.`
        : `${actorName} cancelled the order. Your payment was refunded.`,
      href: "/orders",
    });
    res.json(toApiOrder(result.order));
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

// Loads an order for its chat, which only the buyer and the seller can see.
async function findOrderForParticipant(orderId: string, userId: string) {
  const order = await findOrderById(orderId);
  if (!order) throw notFound("Order not found");
  if (order.buyer_id !== userId && order.seller_id !== userId) {
    throw forbidden("Only the buyer or seller can see this conversation");
  }
  return order;
}

ordersRouter.get("/:id/messages", requireAuth, async (req, res, next) => {
  try {
    const order = await findOrderForParticipant(req.params.id as string, req.userId!);
    const rows = await listOrderMessages(order.id, req.userId!);
    res.json(rows.map(toApiOrderMessage));
  } catch (err) {
    next(err);
  }
});

const orderMessageSchema = z.object({ body: z.string().trim().min(1).max(2000) });

ordersRouter.post("/:id/messages", requireAuth, async (req, res, next) => {
  try {
    const { body } = orderMessageSchema.parse(req.body);
    const order = await findOrderForParticipant(req.params.id as string, req.userId!);
    if (order.status === "cancelled") throw conflict("This order was cancelled");

    const { message, hadUnread } = await createOrderMessage(order.id, req.userId!, body);
    // One notification per batch of unread messages, not one per message.
    if (!hadUnread) {
      const { actorName, otherId } = counterpart(order, req.userId!);
      await createNotification({
        userId: otherId,
        type: "message",
        title: `${actorName} sent you a message about ${order.listing_title}`,
        body,
        href: `/orders?chat=${order.id}`,
      });
    }
    res.status(201).json(toApiOrderMessage(message));
  } catch (err) {
    next(err);
  }
});
