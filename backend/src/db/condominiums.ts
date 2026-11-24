import { pool } from "./pool";
import { addressParams, toDeliveryAddress, type DeliveryAddress } from "./users";

export interface CondominiumRow {
  id: string;
  name: string;
  // Null for condominiums seeded from users.building_name.
  address_postal_code: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  created_at: Date;
}

export function toApiCondominium(row: CondominiumRow) {
  return { id: row.id, name: row.name, address: toDeliveryAddress(row) };
}

export async function listCondominiums(): Promise<CondominiumRow[]> {
  const { rows } = await pool.query<CondominiumRow>("SELECT * FROM condominiums ORDER BY name");
  return rows;
}

export async function findCondominiumById(id: string): Promise<CondominiumRow | null> {
  const { rows } = await pool.query<CondominiumRow>("SELECT * FROM condominiums WHERE id = $1", [id]);
  return rows[0] ?? null;
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
export async function createCondominium(name: string, address: DeliveryAddress): Promise<CondominiumRow | null> {
  const { rows } = await pool.query<CondominiumRow>(
    `INSERT INTO condominiums
       (name, address_postal_code, address_street, address_number, address_complement, address_district, address_city, address_state)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT DO NOTHING RETURNING *`,
    [name, ...addressParams(address)]
  );
  return rows[0] ?? null;
}

// Residents who already joined keep their community; it just can't be picked
// at sign-up anymore.
export async function deleteCondominium(id: string): Promise<boolean> {
  const { rowCount } = await pool.query("DELETE FROM condominiums WHERE id = $1", [id]);
  return (rowCount ?? 0) > 0;
}
