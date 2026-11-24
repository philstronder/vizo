import { pool } from "../../src/db/pool";
import { AUTH_COOKIE_NAME, signAuthToken } from "../../src/lib/jwt";
import { addCreditTransaction } from "../../src/db/credits";

let seq = 0;

export async function insertUser(overrides: { name?: string; buildingName?: string | null; isAdmin?: boolean } = {}) {
  seq += 1;
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (name, email, password_hash, building_name, unit_number, verified, is_admin)
     VALUES ($1, $2, 'x', $3, '1', TRUE, $4) RETURNING id`,
    [
      overrides.name ?? `User ${seq}`,
      `user${seq}@example.com`,
      overrides.buildingName === undefined ? "Aurora" : overrides.buildingName,
      overrides.isAdmin ?? false,
    ]
  );
  return rows[0].id;
}

export async function insertStore(adminId: string) {
  const { rows } = await pool.query<{ id: string }>(
    "INSERT INTO stores (name, created_by) VALUES ('TV Store', $1) RETURNING id",
    [adminId]
  );
  return rows[0].id;
}

export async function insertListing(
  sellerId: string,
  overrides: {
    type?: "direct" | "auction";
    price?: number;
    currentBid?: number;
    maxBidderId?: string;
    quantity?: number;
    storeId?: string;
    status?: string;
  } = {}
) {
  const type = overrides.type ?? "direct";
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO listings (seller_id, title, description, category, condition, type, status, price,
                           starting_price, current_bid, max_bidder_id, auction_ends_at, quantity, store_id)
     VALUES ($1, 'Bike', 'A bike', 'other', 'used-good', $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      sellerId,
      type,
      overrides.status ?? "active",
      type === "direct" ? (overrides.price ?? 100) : null,
      type === "auction" ? 10 : null,
      overrides.currentBid ?? null,
      overrides.maxBidderId ?? null,
      type === "auction" ? new Date(Date.now() + 86_400_000) : null,
      overrides.quantity ?? 1,
      overrides.storeId ?? null,
    ]
  );
  return rows[0].id;
}

export async function giveCredits(userId: string, amount: number) {
  await addCreditTransaction(pool, { userId, type: "refund", amount });
}

export async function getListing(id: string) {
  const { rows } = await pool.query<{ status: string; quantity: number }>(
    "SELECT status, quantity FROM listings WHERE id = $1",
    [id]
  );
  return rows[0];
}

export async function ledger(userId: string) {
  const { rows } = await pool.query<{ type: string; amount: string }>(
    "SELECT type, amount FROM credit_transactions WHERE user_id = $1 ORDER BY created_at",
    [userId]
  );
  return rows.map((r) => ({ type: r.type, amount: Number(r.amount) }));
}

export const tomorrow = () => new Date(Date.now() + 86_400_000);

// A Cookie header that signs an HTTP request in as userId.
export function as(userId: string) {
  return `${AUTH_COOKIE_NAME}=${signAuthToken({ userId })}`;
}

export async function getEmail(userId: string) {
  const { rows } = await pool.query<{ email: string }>("SELECT email FROM users WHERE id = $1", [userId]);
  return rows[0].email;
}

export async function notificationsOf(userId: string) {
  const { rows } = await pool.query<{ type: string; title: string; read: boolean }>(
    "SELECT type, title, read FROM notifications WHERE user_id = $1 ORDER BY created_at",
    [userId]
  );
  return rows;
}
