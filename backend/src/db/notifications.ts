import { pool } from "./pool";

// Data the frontend needs to build the localized title and body.
// `variant` picks between wordings of the same notification type.
export interface NotificationParams {
  listingTitle?: string;
  actorName?: string;
  amount?: number;
  variant?: string;
  buildingName?: string;
  reason?: string; // why a proof of residency was rejected
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  params: NotificationParams | null;
  read: boolean;
  created_at: Date;
}

export function toApiNotification(row: NotificationRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    href: row.href ?? undefined,
    params: row.params ?? undefined,
    read: row.read,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listNotificationsForUser(userId: string): Promise<NotificationRow[]> {
  const { rows } = await pool.query<NotificationRow>(
    "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return rows;
}

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  params?: NotificationParams;
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  await pool.query(
    "INSERT INTO notifications (user_id, type, title, body, href, params) VALUES ($1, $2, $3, $4, $5, $6)",
    [input.userId, input.type, input.title, input.body, input.href ?? null, input.params ?? null]
  );
}

export async function markNotificationRead(id: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await pool.query("UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE", [userId]);
}
