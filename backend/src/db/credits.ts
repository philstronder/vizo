import type { PoolClient } from "pg";
import { pool } from "./pool";

export type CreditType = "sale" | "purchase" | "refund" | "withdrawal";

export interface CreditTransactionRow {
  id: string;
  user_id: string;
  order_id: string | null;
  type: CreditType;
  amount: string;
  pix_key: string | null;
  created_at: Date;
  listing_title: string | null;
}

export function toApiCreditTransaction(row: CreditTransactionRow) {
  return {
    id: row.id,
    orderId: row.order_id ?? undefined,
    type: row.type,
    amount: Number(row.amount),
    listingTitle: row.listing_title ?? undefined,
    pixKey: row.pix_key ?? undefined,
    createdAt: row.created_at.toISOString(),
  };
}

type Queryable = Pick<PoolClient, "query">;

// Locks the user's row so concurrent spends (checkout, withdrawal) of the
// same balance run one after another. Call inside a transaction.
export async function lockBalance(client: PoolClient, userId: string): Promise<number> {
  await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
  return getBalance(client, userId);
}

export async function getBalance(db: Queryable, userId: string): Promise<number> {
  const { rows } = await db.query<{ balance: string }>(
    "SELECT COALESCE(SUM(amount), 0) AS balance FROM credit_transactions WHERE user_id = $1",
    [userId]
  );
  return Number(rows[0].balance);
}

export async function addCreditTransaction(
  db: Queryable,
  entry: { userId: string; type: CreditType; amount: number; orderId?: string; pixKey?: string }
): Promise<void> {
  await db.query(
    "INSERT INTO credit_transactions (user_id, order_id, type, amount, pix_key) VALUES ($1, $2, $3, $4, $5)",
    [entry.userId, entry.orderId ?? null, entry.type, entry.amount, entry.pixKey ?? null]
  );
}

export async function getWallet(userId: string) {
  const [balance, held, history] = await Promise.all([
    getBalance(pool, userId),
    // Sales paid by buyers that are still waiting for both sides to confirm the handoff.
    pool.query<{ held: string }>(
      "SELECT COALESCE(SUM(price - fees), 0) AS held FROM orders WHERE seller_id = $1 AND payment_status = 'held'",
      [userId]
    ),
    pool.query<CreditTransactionRow>(
      `SELECT c.*, l.title AS listing_title
       FROM credit_transactions c
       LEFT JOIN orders o ON o.id = c.order_id
       LEFT JOIN listings l ON l.id = o.listing_id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC
       LIMIT 100`,
      [userId]
    ),
  ]);
  return {
    balance,
    held: Number(held.rows[0].held),
    transactions: history.rows.map(toApiCreditTransaction),
  };
}

// Payouts are mocked until a payment provider is wired up: the withdrawal is
// recorded and the credits leave the balance, but no transfer is made.
export async function withdrawCredits(input: {
  userId: string;
  amount: number;
  pixKey: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const balance = await lockBalance(client, input.userId);
    if (toCents(input.amount) > toCents(balance)) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "You don't have enough credits for this withdrawal" };
    }
    await addCreditTransaction(client, {
      userId: input.userId,
      type: "withdrawal",
      amount: -input.amount,
      pixKey: input.pixKey,
    });
    await client.query("COMMIT");
    return { ok: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export const toCents = (amount: number) => Math.round(amount * 100);
