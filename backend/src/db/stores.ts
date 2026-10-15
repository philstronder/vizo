import { pool } from "./pool";

export interface StoreRow {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: Date;
  product_count: string; // aggregate count() comes back as text
}

const STORE_SELECT = `
  SELECT
    s.id, s.name, s.description, s.created_by, s.created_at,
    (SELECT count(*) FROM listings l WHERE l.store_id = s.id AND l.status = 'active') AS product_count
  FROM stores s
  WHERE s.deleted_at IS NULL
`;

export function toApiStore(row: StoreRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    productCount: Number(row.product_count),
    createdAt: row.created_at.toISOString(),
  };
}

export async function listStores(): Promise<StoreRow[]> {
  const { rows } = await pool.query<StoreRow>(`${STORE_SELECT} ORDER BY s.created_at DESC`);
  return rows;
}

export async function findStoreById(id: string): Promise<StoreRow | null> {
  const { rows } = await pool.query<StoreRow>(`${STORE_SELECT} AND s.id = $1`, [id]);
  return rows[0] ?? null;
}

export interface StoreInput {
  name: string;
  description: string;
}

export async function createStore(input: StoreInput, createdBy: string): Promise<StoreRow> {
  const { rows } = await pool.query<{ id: string }>(
    "INSERT INTO stores (name, description, created_by) VALUES ($1, $2, $3) RETURNING id",
    [input.name, input.description, createdBy]
  );
  return (await findStoreById(rows[0].id))!;
}

export async function updateStore(id: string, input: StoreInput): Promise<StoreRow | null> {
  const { rowCount } = await pool.query(
    "UPDATE stores SET name = $1, description = $2 WHERE id = $3 AND deleted_at IS NULL",
    [input.name, input.description, id]
  );
  if (!rowCount) return null;
  return findStoreById(id);
}

// Soft-deletes the store and takes its unsold products off sale. Rows are
// kept because orders may reference the store's listings.
export async function deleteStore(id: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      "UPDATE stores SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
    if (!rowCount) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(
      "UPDATE listings SET status = 'ended' WHERE store_id = $1 AND status = 'active'",
      [id]
    );
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
