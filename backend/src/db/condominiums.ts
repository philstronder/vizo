import { pool } from "./pool";

export interface CondominiumRow {
  id: string;
  name: string;
  created_at: Date;
}

export function toApiCondominium(row: CondominiumRow) {
  return { id: row.id, name: row.name };
}

export async function listCondominiums(): Promise<CondominiumRow[]> {
  const { rows } = await pool.query<CondominiumRow>("SELECT * FROM condominiums ORDER BY name");
  return rows;
}

// Matched like users.building_name, ignoring case and surrounding spaces.
export async function findCondominiumByName(name: string): Promise<CondominiumRow | null> {
  const { rows } = await pool.query<CondominiumRow>(
    "SELECT * FROM condominiums WHERE lower(trim(name)) = lower(trim($1))",
    [name]
  );
  return rows[0] ?? null;
}

// Returns null when a condominium with the same name already exists.
export async function createCondominium(name: string): Promise<CondominiumRow | null> {
  const { rows } = await pool.query<CondominiumRow>(
    "INSERT INTO condominiums (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING *",
    [name]
  );
  return rows[0] ?? null;
}

// Residents who already joined keep their community; it just can't be picked
// at sign-up anymore.
export async function deleteCondominium(id: string): Promise<boolean> {
  const { rowCount } = await pool.query("DELETE FROM condominiums WHERE id = $1", [id]);
  return (rowCount ?? 0) > 0;
}
