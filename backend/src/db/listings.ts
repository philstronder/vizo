import { pool } from "./pool";

export interface ListingRow {
  id: string;
  seller_id: string;
  store_id: string | null;
  seller_name: string;
  seller_unit_number: string;
  seller_building_name: string;
  seller_verified: boolean;
  seller_member_since: Date;
  title: string;
  description: string;
  category: string;
  condition: string;
  type: "direct" | "auction";
  status: string;
  images: string[];
  quantity: number;
  price: string | null;
  starting_price: string | null;
  current_bid: string | null;
  max_bidder_id: string | null;
  auction_ends_at: Date | null;
  created_at: Date;
  bid_count: string; // aggregate count() comes back as text
  seller_rating: string | null; // avg() is numeric, also text; null with no reviews
  seller_review_count: string;
}

const LISTING_SELECT = `
  SELECT
    l.*,
    u.name AS seller_name,
    u.unit_number AS seller_unit_number,
    u.building_name AS seller_building_name,
    u.verified AS seller_verified,
    u.created_at AS seller_member_since,
    COALESCE((SELECT count(*) FROM bids b WHERE b.listing_id = l.id), 0) AS bid_count,
    (SELECT avg(r.rating) FROM seller_reviews r WHERE r.seller_id = l.seller_id) AS seller_rating,
    (SELECT count(*) FROM seller_reviews r WHERE r.seller_id = l.seller_id) AS seller_review_count
  FROM listings l
  JOIN users u ON u.id = l.seller_id
`;

export function toApiListing(row: ListingRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    condition: row.condition,
    type: row.type,
    status: row.status,
    images: row.images,
    quantity: row.quantity,
    sellerId: row.seller_id,
    storeId: row.store_id ?? undefined,
    sellerName: row.seller_name,
    sellerUnitNumber: row.seller_unit_number,
    sellerBuildingName: row.seller_building_name,
    sellerVerified: row.seller_verified,
    sellerMemberSince: row.seller_member_since.toISOString(),
    sellerRating: row.seller_rating !== null ? Number(row.seller_rating) : undefined,
    sellerReviewCount: Number(row.seller_review_count),
    createdAt: row.created_at.toISOString(),
    price: row.price !== null ? Number(row.price) : undefined,
    startingPrice: row.starting_price !== null ? Number(row.starting_price) : undefined,
    currentBid: row.current_bid !== null ? Number(row.current_bid) : undefined,
    bidCount: row.type === "auction" ? Number(row.bid_count) : undefined,
    maxBidderId: row.max_bidder_id ?? undefined,
    auctionEndsAt: row.auction_ends_at ? row.auction_ends_at.toISOString() : undefined,
  };
}

export interface ListingFilters {
  status?: string;
  category?: string;
  type?: "direct" | "auction";
  sellerId?: string;
  q?: string;
  // Exactly one scope applies: a store's products, or a building's
  // community listings (which never include store products).
  storeId?: string;
  buildingName?: string;
}

export async function listListings(filters: ListingFilters): Promise<ListingRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  function addFilter(sql: string, value: unknown) {
    params.push(value);
    conditions.push(sql.replace("?", `$${params.length}`));
  }

  if (filters.status) addFilter("l.status = ?", filters.status);
  if (filters.category) addFilter("l.category = ?", filters.category);
  if (filters.type) addFilter("l.type = ?", filters.type);
  if (filters.sellerId) addFilter("l.seller_id = ?", filters.sellerId);
  if (filters.storeId) addFilter("l.store_id = ?", filters.storeId);
  if (filters.buildingName !== undefined) {
    conditions.push("l.store_id IS NULL");
    addFilter("lower(trim(u.building_name)) = lower(trim(?))", filters.buildingName);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    const titlePlaceholder = `$${params.length}`;
    params.push(`%${filters.q}%`);
    const descriptionPlaceholder = `$${params.length}`;
    conditions.push(`(l.title ILIKE ${titlePlaceholder} OR l.description ILIKE ${descriptionPlaceholder})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query<ListingRow>(
    `${LISTING_SELECT} ${where} ORDER BY l.created_at DESC`,
    params
  );
  return rows;
}

export async function findListingById(id: string): Promise<ListingRow | null> {
  const { rows } = await pool.query<ListingRow>(`${LISTING_SELECT} WHERE l.id = $1`, [id]);
  return rows[0] ?? null;
}

export interface CreateListingInput {
  sellerId: string;
  storeId?: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  images: string[];
  type: "direct" | "auction";
  quantity?: number;
  price?: number;
  startingPrice?: number;
  auctionEndsAt?: Date;
}

export async function createListing(input: CreateListingInput): Promise<ListingRow> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO listings
      (seller_id, title, description, category, condition, type, images, price, starting_price, current_bid, auction_ends_at, store_id, quantity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11, $12)
     RETURNING id`,
    [
      input.sellerId,
      input.title,
      input.description,
      input.category,
      input.condition,
      input.type,
      input.images,
      input.price ?? null,
      input.startingPrice ?? null,
      input.auctionEndsAt ?? null,
      input.storeId ?? null,
      input.quantity ?? 1,
    ]
  );
  const created = await findListingById(rows[0].id);
  return created!;
}

export async function deleteListing(id: string, sellerId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "DELETE FROM listings WHERE id = $1 AND seller_id = $2",
    [id, sellerId]
  );
  return (rowCount ?? 0) > 0;
}

export async function markListingSold(id: string): Promise<void> {
  await pool.query("UPDATE listings SET status = 'sold' WHERE id = $1", [id]);
}

// Adds units to a store product and puts it back on sale. Products of deleted
// stores, and community listings, can't be restocked.
export async function restockListing(id: string, units: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE listings l SET quantity = l.quantity + $2, status = 'active'
     FROM stores s
     WHERE l.id = $1 AND s.id = l.store_id AND s.deleted_at IS NULL
       AND l.type = 'direct' AND l.status IN ('active', 'sold')`,
    [id, units]
  );
  return (rowCount ?? 0) > 0;
}

export interface BidRow {
  id: string;
  listing_id: string;
  bidder_id: string;
  bidder_name: string;
  amount: string;
  created_at: Date;
}

export function toApiBid(row: BidRow) {
  return {
    id: row.id,
    listingId: row.listing_id,
    bidderId: row.bidder_id,
    bidderName: row.bidder_name,
    amount: Number(row.amount),
    createdAt: row.created_at.toISOString(),
  };
}

export async function listBidsForListing(listingId: string): Promise<BidRow[]> {
  const { rows } = await pool.query<BidRow>(
    `SELECT b.*, u.name AS bidder_name
     FROM bids b
     JOIN users u ON u.id = b.bidder_id
     WHERE b.listing_id = $1
     ORDER BY b.created_at DESC`,
    [listingId]
  );
  return rows;
}

// Places a bid transactionally: locks the listing row, validates the bid
// beats the current price, inserts the bid, and updates the listing's
// current_bid/max_bidder_id in one atomic unit.
export async function placeBidTx(
  listingId: string,
  bidderId: string,
  amount: number
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{
      type: string;
      status: string;
      current_bid: string | null;
      starting_price: string | null;
      auction_ends_at: Date | null;
    }>(
      "SELECT type, status, current_bid, starting_price, auction_ends_at FROM listings WHERE id = $1 FOR UPDATE",
      [listingId]
    );
    const listing = rows[0];
    if (!listing) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "Listing not found" };
    }
    if (listing.type !== "auction" || listing.status !== "active") {
      await client.query("ROLLBACK");
      return { ok: false, reason: "This listing is not an active auction" };
    }
    if (listing.auction_ends_at && listing.auction_ends_at.getTime() < Date.now()) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "This auction has ended" };
    }
    const floor = Number(listing.current_bid ?? listing.starting_price ?? 0);
    if (amount <= floor) {
      await client.query("ROLLBACK");
      return { ok: false, reason: `Bid must be greater than ${floor}` };
    }

    await client.query(
      "INSERT INTO bids (listing_id, bidder_id, amount) VALUES ($1, $2, $3)",
      [listingId, bidderId, amount]
    );
    await client.query(
      "UPDATE listings SET current_bid = $1, max_bidder_id = $2 WHERE id = $3",
      [amount, bidderId, listingId]
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
