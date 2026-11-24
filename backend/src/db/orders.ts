import type { PoolClient } from "pg";
import { pool } from "./pool";
import { toDeliveryAddress, type UserRow } from "./users";
import { addCreditTransaction, lockBalance, toCents } from "./credits";
import type { ErrorCode, ErrorParams } from "../lib/http-error";

// The buyer's address_* columns are joined in for store order deliveries.
export interface OrderRow
  extends Pick<
    UserRow,
    | "address_postal_code"
    | "address_street"
    | "address_number"
    | "address_complement"
    | "address_district"
    | "address_city"
    | "address_state"
  > {
  id: string;
  listing_id: string;
  listing_title: string;
  listing_image: string | null;
  buyer_id: string;
  buyer_name: string;
  seller_id: string;
  seller_name: string;
  price: string;
  fees: string;
  status: string;
  pickup_location: string | null;
  pickup_time: string | null;
  created_at: Date;
  review_rating: number | null;
  buyer_review_rating: number | null;
  buyer_rating: string | null; // avg() is numeric, read as text; null with no reviews
  buyer_review_count: string;
  store_id: string | null;
  buyer_phone: string | null;
  payment_status: "held" | "released" | "refunded" | null;
  paid_with_credits: string;
  meetup_at: Date | null;
  meetup_proposed_by: string | null;
  meetup_confirmed: boolean;
  buyer_confirmed_at: Date | null;
  seller_confirmed_at: Date | null;
  // Only set by listOrdersForUser: messages from the other side the user hasn't read.
  unread_messages?: number;
}

const OPEN_STATUSES = ["pending_pickup", "ready_for_pickup", "shipped"];


const ORDER_SELECT = `
  SELECT
    o.*,
    l.title AS listing_title,
    (CASE WHEN array_length(l.images, 1) > 0 THEN l.images[1] ELSE NULL END) AS listing_image,
    buyer.name AS buyer_name,
    seller.name AS seller_name,
    r.rating AS review_rating,
    br.rating AS buyer_review_rating,
    (SELECT avg(x.rating) FROM buyer_reviews x WHERE x.buyer_id = o.buyer_id) AS buyer_rating,
    (SELECT count(*) FROM buyer_reviews x WHERE x.buyer_id = o.buyer_id) AS buyer_review_count,
    l.store_id,
    buyer.phone AS buyer_phone,
    buyer.address_postal_code,
    buyer.address_street,
    buyer.address_number,
    buyer.address_complement,
    buyer.address_district,
    buyer.address_city,
    buyer.address_state
  FROM orders o
  JOIN listings l ON l.id = o.listing_id
  JOIN users buyer ON buyer.id = o.buyer_id
  JOIN users seller ON seller.id = o.seller_id
  LEFT JOIN seller_reviews r ON r.order_id = o.id
  LEFT JOIN buyer_reviews br ON br.order_id = o.id
`;

// Store products are delivered, so their orders carry the buyer's phone and
// delivery address for the store admin (and the buyer) to see.
export function toApiOrder(row: OrderRow) {
  return {
    id: row.id,
    listingId: row.listing_id,
    listingTitle: row.listing_title,
    listingImage: row.listing_image ?? row.listing_id,
    buyerId: row.buyer_id,
    buyerName: row.buyer_name,
    sellerId: row.seller_id,
    sellerName: row.seller_name,
    price: Number(row.price),
    fees: Number(row.fees),
    status: row.status,
    pickupLocation: row.pickup_location ?? undefined,
    pickupTime: row.pickup_time ?? undefined,
    createdAt: row.created_at.toISOString(),
    reviewRating: row.review_rating ?? undefined,
    buyerReviewRating: row.buyer_review_rating ?? undefined,
    buyerRating: row.buyer_rating !== null ? Number(row.buyer_rating) : undefined,
    buyerReviewCount: Number(row.buyer_review_count),
    buyerPhone: row.store_id ? (row.buyer_phone ?? undefined) : undefined,
    deliveryAddress: row.store_id ? toDeliveryAddress(row) : undefined,
    isStoreOrder: !!row.store_id,
    paymentStatus: row.payment_status ?? undefined,
    paidWithCredits: Number(row.paid_with_credits),
    meetupAt: row.meetup_at?.toISOString(),
    meetupProposedBy: row.meetup_proposed_by
      ? row.meetup_proposed_by === row.buyer_id ? "buyer" : "seller"
      : undefined,
    meetupConfirmed: row.meetup_confirmed,
    buyerConfirmedDelivery: !!row.buyer_confirmed_at,
    sellerConfirmedDelivery: !!row.seller_confirmed_at,
    unreadMessages: row.unread_messages,
  };
}

export async function listOrdersForUser(userId: string): Promise<OrderRow[]> {
  const { rows } = await pool.query<OrderRow>(
    `SELECT * FROM (${ORDER_SELECT}) o,
       LATERAL (
         SELECT COUNT(*)::int AS unread_messages FROM order_messages m
         WHERE m.order_id = o.id AND m.author_id <> $1 AND m.read_at IS NULL
       ) unread
     WHERE o.buyer_id = $1 OR o.seller_id = $1
     ORDER BY o.created_at DESC`,
    [userId]
  );
  return rows;
}

export interface CreateOrderInput {
  listingId: string;
  buyerId: string;
  pickupLocation?: string;
  meetupAt?: Date;
  useCredits?: boolean;
}

// Buying a listing transactionally: locks the listing, verifies it's
// purchasable, snapshots the agreed price, takes one unit (marking it sold
// when none are left), and creates the order in one atomic unit.
// Community sales need a suggested meetup time and their payment is held by
// the platform until both sides confirm the handoff. With useCredits, the
// buyer's credits pay as much of the price as they cover.
export async function checkoutListingTx(
  input: CreateOrderInput
): Promise<{ ok: true; orderId: string } | { ok: false; reason: ErrorCode }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{
      id: string;
      seller_id: string;
      type: string;
      status: string;
      price: string | null;
      current_bid: string | null;
      max_bidder_id: string | null;
      quantity: number;
      store_id: string | null;
    }>(
      "SELECT id, seller_id, type, status, price, current_bid, max_bidder_id, quantity, store_id FROM listings WHERE id = $1 FOR UPDATE",
      [input.listingId]
    );
    const listing = rows[0];
    if (!listing) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "listing_not_found" };
    }
    if (listing.seller_id === input.buyerId) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "cannot_buy_own_listing" };
    }
    if (listing.status !== "active" || listing.quantity < 1) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "listing_unavailable" };
    }
    if (listing.type === "auction" && listing.max_bidder_id !== input.buyerId) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "only_winning_bidder" };
    }

    const isCommunitySale = !listing.store_id;
    if (isCommunitySale && !input.meetupAt) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "meetup_time_required" };
    }

    const price = Number(listing.type === "auction" ? listing.current_bid : listing.price);
    let paidWithCredits = 0;
    if (input.useCredits) {
      const balance = await lockBalance(client, input.buyerId);
      paidWithCredits = Math.min(toCents(balance), toCents(price)) / 100;
    }

    await client.query(
      `UPDATE listings
       SET quantity = quantity - 1,
           status = CASE WHEN quantity - 1 = 0 THEN 'sold' ELSE status END
       WHERE id = $1`,
      [input.listingId]
    );
    const { rows: orderRows } = await client.query<{ id: string }>(
      `INSERT INTO orders (listing_id, buyer_id, seller_id, price, pickup_location,
                           payment_status, paid_with_credits, meetup_at, meetup_proposed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        input.listingId,
        input.buyerId,
        listing.seller_id,
        price,
        input.pickupLocation ?? null,
        isCommunitySale ? "held" : null,
        paidWithCredits,
        isCommunitySale ? input.meetupAt : null,
        isCommunitySale ? input.buyerId : null,
      ]
    );
    const orderId = orderRows[0].id;
    if (paidWithCredits > 0) {
      await addCreditTransaction(client, {
        userId: input.buyerId,
        type: "purchase",
        amount: -paidWithCredits,
        orderId,
      });
    }
    await client.query("COMMIT");
    return { ok: true, orderId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function findOrderById(id: string): Promise<OrderRow | null> {
  const { rows } = await pool.query<OrderRow>(`${ORDER_SELECT} WHERE o.id = $1`, [id]);
  return rows[0] ?? null;
}

type OrderResult<T> =
  | { ok: true; order: OrderRow; value: T }
  | { ok: false; status: 403 | 404 | 409; reason: ErrorCode; params?: ErrorParams };

// Thrown inside withLockedOrder to roll back and answer 409.
class OrderConflict extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly params?: ErrorParams
  ) {
    super(code);
  }
}

// Runs fn on the order with its row locked, after checking that userId is the
// buyer or the seller, and returns the updated order.
async function withLockedOrder<T>(
  orderId: string,
  userId: string,
  fn: (client: PoolClient, order: OrderRow) => Promise<T>
): Promise<OrderResult<T>> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<OrderRow>(`${ORDER_SELECT} WHERE o.id = $1 FOR UPDATE OF o`, [orderId]);
    const order = rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return { ok: false, status: 404, reason: "order_not_found" };
    }
    if (order.buyer_id !== userId && order.seller_id !== userId) {
      await client.query("ROLLBACK");
      return { ok: false, status: 403, reason: "order_participants_only" };
    }
    const value = await fn(client, order);
    await client.query("COMMIT");
    const updated = await findOrderById(orderId);
    return { ok: true, order: updated!, value };
  } catch (err) {
    await client.query("ROLLBACK");
    if (err instanceof OrderConflict) return { ok: false, status: 409, reason: err.code, params: err.params };
    throw err;
  } finally {
    client.release();
  }
}

function conflict(code: ErrorCode, params?: ErrorParams): never {
  throw new OrderConflict(code, params);
}

function assertOpen(order: OrderRow) {
  if (!OPEN_STATUSES.includes(order.status)) conflict("order_already_status", { status: order.status });
}

export type HandoffReview = { rating: number; comment?: string };

// Records that userId handed over (seller) or received (buyer) the item.
// Store orders complete on the first confirmation, as before. Community
// orders complete once both sides have confirmed, which releases the held
// payment to the seller as credits. Rating the other side is mandatory on
// community orders, so each side's confirmation carries its review: the
// buyer's goes to seller_reviews and the seller's to buyer_reviews.
export async function confirmDelivery(orderId: string, userId: string, review?: HandoffReview) {
  return withLockedOrder(orderId, userId, async (client, order) => {
    assertOpen(order);
    const isBuyer = order.buyer_id === userId;
    if (isBuyer ? order.buyer_confirmed_at : order.seller_confirmed_at) {
      conflict("delivery_already_confirmed");
    }

    // The seller has to agree to a meetup time before the handoff can happen.
    if (!order.store_id && order.meetup_at && !order.meetup_confirmed) {
      conflict("meetup_not_agreed");
    }

    if (!order.store_id) {
      if (!review) conflict(isBuyer ? "rate_seller_to_confirm" : "rate_buyer_to_confirm");
      await client.query(
        `INSERT INTO ${isBuyer ? "seller_reviews" : "buyer_reviews"} (order_id, seller_id, buyer_id, rating, comment)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (order_id) DO NOTHING`,
        [order.id, order.seller_id, order.buyer_id, review.rating, review.comment ?? null]
      );
    }

    const otherConfirmed = isBuyer ? !!order.seller_confirmed_at : !!order.buyer_confirmed_at;
    const completed = !!order.store_id || otherConfirmed;
    const release = completed && order.payment_status === "held";
    await client.query(
      `UPDATE orders SET
         ${isBuyer ? "buyer_confirmed_at" : "seller_confirmed_at"} = now(),
         status = CASE WHEN $2 THEN 'completed'::order_status ELSE status END,
         payment_status = CASE WHEN $3 THEN 'released'::payment_status ELSE payment_status END
       WHERE id = $1`,
      [orderId, completed, release]
    );
    const releasedAmount = release ? Number(order.price) - Number(order.fees) : 0;
    if (releasedAmount > 0) {
      await addCreditTransaction(client, {
        userId: order.seller_id,
        type: "sale",
        amount: releasedAmount,
        orderId,
      });
    }
    return { completed, releasedAmount };
  });
}

// Either side proposes a (new) meetup time; it's agreed once the other accepts.
export async function proposeMeetup(orderId: string, userId: string, meetupAt: Date) {
  return withLockedOrder(orderId, userId, async (client, order) => {
    if (order.store_id) conflict("store_order_no_meetup");
    assertOpen(order);
    await client.query(
      "UPDATE orders SET meetup_at = $2, meetup_proposed_by = $3, meetup_confirmed = FALSE WHERE id = $1",
      [orderId, meetupAt, userId]
    );
  });
}

export async function acceptMeetup(orderId: string, userId: string) {
  return withLockedOrder(orderId, userId, async (client, order) => {
    assertOpen(order);
    if (!order.meetup_at) conflict("no_meetup_proposed");
    if (order.meetup_confirmed) conflict("meetup_already_confirmed");
    if (order.meetup_proposed_by === userId) {
      conflict("waiting_other_side_meetup");
    }
    await client.query("UPDATE orders SET meetup_confirmed = TRUE WHERE id = $1", [orderId]);
  });
}

// Cancels an open community order, refunds the buyer and puts the item back
// on sale. The seller can cancel until a handoff is confirmed; the buyer only
// until the meetup is agreed, so the seller isn't left waiting at a meetup
// the buyer walked away from. Credits the buyer spent come back as credits;
// the card part is refunded to the card (mocked).
export async function cancelOrder(orderId: string, userId: string) {
  return withLockedOrder(orderId, userId, async (client, order) => {
    if (order.store_id) conflict("store_order_no_cancel");
    assertOpen(order);
    if (order.buyer_confirmed_at || order.seller_confirmed_at) {
      conflict("handoff_already_confirmed");
    }
    if (order.buyer_id === userId && order.meetup_confirmed) {
      conflict("meetup_agreed_ask_seller");
    }

    await client.query(
      `UPDATE orders SET status = 'cancelled',
         payment_status = CASE WHEN payment_status = 'held' THEN 'refunded'::payment_status ELSE payment_status END
       WHERE id = $1`,
      [orderId]
    );
    const credits = Number(order.paid_with_credits);
    if (credits > 0) {
      await addCreditTransaction(client, { userId: order.buyer_id, type: "refund", amount: credits, orderId });
    }
    // Direct sales go back on sale; a cancelled auction just ends.
    await client.query(
      `UPDATE listings SET
         quantity = quantity + 1,
         status = CASE WHEN type = 'direct' THEN 'active'::listing_status ELSE 'ended'::listing_status END
       WHERE id = $1`,
      [order.listing_id]
    );
    return { cancelledByBuyer: order.buyer_id === userId };
  });
}

type ReviewInput = { orderId: string; userId: string; rating: number; comment?: string };
type ReviewResult = { ok: true } | { ok: false; status: 403 | 404 | 409; reason: ErrorCode; params?: ErrorParams };

// Once an order is completed, the buyer rates the seller (seller_reviews) and
// the seller rates the buyer (buyer_reviews). The UNIQUE order_id constraint
// makes ON CONFLICT the one-review-per-order guard.
async function insertReview(
  input: ReviewInput,
  side: { table: "seller_reviews" | "buyer_reviews"; author: "buyer_id" | "seller_id"; notAuthor: ErrorCode; notCompleted: ErrorCode }
): Promise<ReviewResult> {
  const order = await findOrderById(input.orderId);
  if (!order) return { ok: false, status: 404, reason: "order_not_found" };
  if (order[side.author] !== input.userId) return { ok: false, status: 403, reason: side.notAuthor };
  if (order.status !== "completed") return { ok: false, status: 409, reason: side.notCompleted };

  const { rowCount } = await pool.query(
    `INSERT INTO ${side.table} (order_id, seller_id, buyer_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (order_id) DO NOTHING`,
    [order.id, order.seller_id, order.buyer_id, input.rating, input.comment ?? null]
  );
  if (!rowCount) return { ok: false, status: 409, reason: "already_rated" };
  return { ok: true };
}

// The buyer rates the seller.
export function reviewOrder(input: ReviewInput): Promise<ReviewResult> {
  return insertReview(input, {
    table: "seller_reviews",
    author: "buyer_id",
    notAuthor: "only_buyer_can_rate",
    notCompleted: "rate_after_delivery",
  });
}

// The seller rates the buyer.
export function reviewBuyer(input: ReviewInput): Promise<ReviewResult> {
  return insertReview(input, {
    table: "buyer_reviews",
    author: "seller_id",
    notAuthor: "only_seller_can_rate_buyer",
    notCompleted: "rate_buyer_after_delivery",
  });
}
