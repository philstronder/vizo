import { pool } from "./pool";

export interface MessageRow {
  id: string;
  listing_id: string;
  author_id: string;
  author_name: string;
  seller_id: string;
  body: string;
  created_at: Date;
}

export function toApiMessage(row: MessageRow) {
  return {
    id: row.id,
    listingId: row.listing_id,
    authorId: row.author_id,
    authorName: row.author_name,
    role: row.author_id === row.seller_id ? "seller" : "buyer",
    body: row.body,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listMessagesForListing(listingId: string): Promise<MessageRow[]> {
  const { rows } = await pool.query<MessageRow>(
    `SELECT m.*, u.name AS author_name, l.seller_id
     FROM messages m
     JOIN users u ON u.id = m.author_id
     JOIN listings l ON l.id = m.listing_id
     WHERE m.listing_id = $1
     ORDER BY m.created_at ASC`,
    [listingId]
  );
  return rows;
}

export async function createMessage(
  listingId: string,
  authorId: string,
  body: string
): Promise<MessageRow> {
  const { rows } = await pool.query<{ id: string }>(
    "INSERT INTO messages (listing_id, author_id, body) VALUES ($1, $2, $3) RETURNING id",
    [listingId, authorId, body]
  );
  const full = await pool.query<MessageRow>(
    `SELECT m.*, u.name AS author_name, l.seller_id
     FROM messages m
     JOIN users u ON u.id = m.author_id
     JOIN listings l ON l.id = m.listing_id
     WHERE m.id = $1`,
    [rows[0].id]
  );
  return full.rows[0];
}
