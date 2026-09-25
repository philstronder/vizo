import { Router } from "express";
import { z } from "zod";
import {
  createListing,
  deleteListing,
  findListingById,
  listBidsForListing,
  listListings,
  placeBidTx,
  toApiBid,
  toApiListing,
} from "../db/listings";
import { createMessage, listMessagesForListing, toApiMessage } from "../db/messages";
import { createNotification } from "../db/notifications";
import { requireAuth } from "../middleware/auth";
import { badRequest, forbidden, notFound } from "../lib/http-error";

export const listingsRouter = Router();

const categoryEnum = z.enum(["furniture", "electronics", "books", "plants", "other"]);
const conditionEnum = z.enum(["new", "used-excellent", "used-good"]);

listingsRouter.get("/", async (req, res, next) => {
  try {
    const { status, category, type, q, sellerId } = req.query;
    // Default to active-only for the general marketplace feed, but when
    // scoped to a specific seller (e.g. "My Listings"), show every status
    // unless the caller explicitly asks for one.
    const resolvedStatus =
      typeof status === "string" ? status : typeof sellerId === "string" ? undefined : "active";
    const rows = await listListings({
      status: resolvedStatus,
      category: typeof category === "string" ? category : undefined,
      type: type === "direct" || type === "auction" ? type : undefined,
      q: typeof q === "string" ? q : undefined,
      sellerId: typeof sellerId === "string" ? sellerId : undefined,
    });
    res.json(rows.map(toApiListing));
  } catch (err) {
    next(err);
  }
});

const createListingSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    category: categoryEnum,
    condition: conditionEnum,
    images: z.array(z.string()).max(5).default([]),
    type: z.enum(["direct", "auction"]),
    price: z.number().positive().optional(),
    startingPrice: z.number().positive().optional(),
    auctionDurationDays: z.union([z.literal(1), z.literal(3), z.literal(7)]).optional(),
  })
  .refine((data) => data.type !== "direct" || data.price !== undefined, {
    message: "price is required for direct sale listings",
    path: ["price"],
  })
  .refine((data) => data.type !== "auction" || data.startingPrice !== undefined, {
    message: "startingPrice is required for auction listings",
    path: ["startingPrice"],
  });

listingsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const input = createListingSchema.parse(req.body);
    const listing = await createListing({
      sellerId: req.userId!,
      title: input.title,
      description: input.description,
      category: input.category,
      condition: input.condition,
      images: input.images,
      type: input.type,
      price: input.price,
      startingPrice: input.startingPrice,
      auctionEndsAt:
        input.type === "auction"
          ? new Date(Date.now() + (input.auctionDurationDays ?? 3) * 24 * 60 * 60 * 1000)
          : undefined,
    });
    res.status(201).json(toApiListing(listing));
  } catch (err) {
    next(err);
  }
});

listingsRouter.get("/:id", async (req, res, next) => {
  try {
    const listingId = req.params.id as string;
    const listing = await findListingById(listingId);
    if (!listing) throw notFound("Listing not found");
    res.json(toApiListing(listing));
  } catch (err) {
    next(err);
  }
});

listingsRouter.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const listingId = req.params.id as string;
    const deleted = await deleteListing(listingId, req.userId!);
    if (!deleted) throw notFound("Listing not found, or you don't own it");
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

listingsRouter.get("/:id/bids", async (req, res, next) => {
  try {
    const listingId = req.params.id as string;
    const rows = await listBidsForListing(listingId);
    res.json(rows.map(toApiBid));
  } catch (err) {
    next(err);
  }
});

const placeBidSchema = z.object({ amount: z.number().positive() });

listingsRouter.post("/:id/bids", requireAuth, async (req, res, next) => {
  try {
    const listingId = req.params.id as string;
    const { amount } = placeBidSchema.parse(req.body);
    const listing = await findListingById(listingId);
    if (!listing) throw notFound("Listing not found");
    if (listing.seller_id === req.userId) throw forbidden("You cannot bid on your own listing");

    const result = await placeBidTx(listingId, req.userId!, amount);
    if (!result.ok) throw badRequest(result.reason);

    await createNotification({
      userId: listing.seller_id,
      type: "new_bid",
      title: `New bid on ${listing.title}`,
      body: `Someone bid $${amount}.`,
      href: `/listing/${listing.id}`,
    });

    const updated = await findListingById(listingId);
    res.status(201).json(toApiListing(updated!));
  } catch (err) {
    next(err);
  }
});

listingsRouter.get("/:id/messages", async (req, res, next) => {
  try {
    const listingId = req.params.id as string;
    const rows = await listMessagesForListing(listingId);
    res.json(rows.map(toApiMessage));
  } catch (err) {
    next(err);
  }
});

const postMessageSchema = z.object({ body: z.string().trim().min(1) });

listingsRouter.post("/:id/messages", requireAuth, async (req, res, next) => {
  try {
    const listingId = req.params.id as string;
    const { body } = postMessageSchema.parse(req.body);
    const listing = await findListingById(listingId);
    if (!listing) throw notFound("Listing not found");

    const message = await createMessage(listingId, req.userId!, body);

    if (req.userId !== listing.seller_id) {
      await createNotification({
        userId: listing.seller_id,
        type: "message",
        title: `New message on ${listing.title}`,
        body,
        href: `/listing/${listing.id}`,
      });
    }

    res.status(201).json(toApiMessage(message));
  } catch (err) {
    next(err);
  }
});
