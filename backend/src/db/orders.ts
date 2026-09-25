import { pool } from "./pool";

export interface OrderRow {
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
}

const ORDER_SELECT = `
  SELECT
    o.*,
    l.title AS listing_title,
    (CASE WHEN array_length(l.images, 1) > 0 THEN l.images[1] ELSE NULL END) AS listing_image,
    buyer.name AS buyer_name,
    seller.name AS seller_name
  FROM orders o
  JOIN listings l ON l.id = o.listing_id
  JOIN users buyer ON buyer.id = o.buyer_id
  JOIN users seller ON seller.id = o.seller_id
`;

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
  };
}

export async function listOrdersForUser(userId: string): Promise<OrderRow[]> {
  const { rows } = await pool.query<OrderRow>(
    `${ORDER_SELECT} WHERE o.buyer_id = $1 OR o.seller_id = $1 ORDER BY o.created_at DESC`,
    [userId]
  );
  return rows;
}

export interface CreateOrderInput {
  listingId: string;
  buyerId: string;
  pickupLocation?: string;
  pickupTime?: string;
}

// Buying a listing transactionally: locks the listing, verifies it's
// purchasable, snapshots the agreed price, marks it sold, and creates the
// order in one atomic unit.
export async function checkoutListingTx(
  input: CreateOrderInput
): Promise<{ ok: true; orderId: string } | { ok: false; reason: string }> {
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
    }>(
      "SELECT id, seller_id, type, status, price, current_bid, max_bidder_id FROM listings WHERE id = $1 FOR UPDATE",
      [input.listingId]
    );
    const listing = rows[0];
    if (!listing) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "Listing not found" };
    }
    if (listing.seller_id === input.buyerId) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "You cannot buy your own listing" };
    }
    if (listing.status !== "active") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "This listing is no longer available" };
    }
    if (listing.type === "auction" && listing.max_bidder_id !== input.buyerId) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "Only the winning bidder can check out this auction" };
    }

    const price = Number(listing.type === "auction" ? listing.current_bid : listing.price);
    await client.query("UPDATE listings SET status = 'sold' WHERE id = $1", [input.listingId]);
    const { rows: orderRows } = await client.query<{ id: string }>(
      `INSERT INTO orders (listing_id, buyer_id, seller_id, price, pickup_location, pickup_time)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [input.listingId, input.buyerId, listing.seller_id, price, input.pickupLocation ?? null, input.pickupTime ?? null]
    );
    await client.query("COMMIT");
    return { ok: true, orderId: orderRows[0].id };
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
