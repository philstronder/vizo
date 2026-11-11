import { pool } from "./pool";

export interface OrderMessageRow {
  id: string;
  order_id: string;
  author_id: string;
  author_name: string;
  body: string;
  read_at: Date | null;
  created_at: Date;
}

export function toApiOrderMessage(row: OrderMessageRow) {
  return {
    id: row.id,
    orderId: row.order_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    read: !!row.read_at,
    createdAt: row.created_at.toISOString(),
  };
}

const MESSAGE_SELECT = `
  SELECT m.*, u.name AS author_name
  FROM order_messages m
  JOIN users u ON u.id = m.author_id
`;

// Returns the conversation and marks the other participant's messages as read
// by readerId.
export async function listOrderMessages(orderId: string, readerId: string): Promise<OrderMessageRow[]> {
  await pool.query(
    "UPDATE order_messages SET read_at = now() WHERE order_id = $1 AND author_id <> $2 AND read_at IS NULL",
    [orderId, readerId]
  );
  const { rows } = await pool.query<OrderMessageRow>(
    `${MESSAGE_SELECT} WHERE m.order_id = $1 ORDER BY m.created_at ASC`,
    [orderId]
  );
  return rows;
}

// Creates the message. hadUnread says whether the author already had messages
// the other side hasn't read, so callers notify once per batch, not per message.
export async function createOrderMessage(
  orderId: string,
  authorId: string,
  body: string
): Promise<{ message: OrderMessageRow; hadUnread: boolean }> {
  const { rows: unread } = await pool.query(
    "SELECT 1 FROM order_messages WHERE order_id = $1 AND author_id = $2 AND read_at IS NULL LIMIT 1",
    [orderId, authorId]
  );
  const { rows } = await pool.query<{ id: string }>(
    "INSERT INTO order_messages (order_id, author_id, body) VALUES ($1, $2, $3) RETURNING id",
    [orderId, authorId, body]
  );
  const full = await pool.query<OrderMessageRow>(`${MESSAGE_SELECT} WHERE m.id = $1`, [rows[0].id]);
  return { message: full.rows[0], hadUnread: unread.length > 0 };
}
