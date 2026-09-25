import { pool } from "./pool";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  building_name: string;
  unit_number: string;
  verified: boolean;
  created_at: Date;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  buildingName: string;
  unitNumber: string;
  verified: boolean;
  memberSince: string;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    buildingName: row.building_name,
    unitNumber: row.unit_number,
    verified: row.verified,
    memberSince: row.created_at.toISOString(),
  };
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE email = $1", [email]);
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  buildingName: string;
  unitNumber: string;
  // Address verification is a manual/async review step in a real deployment
  // (an admin or a document-verification API confirms the uploaded proof).
  // We mark accounts verified immediately here so the mock flow stays usable;
  // flip the default to FALSE once that review step exists.
  verified?: boolean;
}

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (name, email, password_hash, building_name, unit_number, verified)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.name,
      input.email,
      input.passwordHash,
      input.buildingName,
      input.unitNumber,
      input.verified ?? true,
    ]
  );
  return rows[0];
}

export interface UpdateUserInput {
  name: string;
  buildingName: string;
  unitNumber: string;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `UPDATE users SET name = $1, building_name = $2, unit_number = $3 WHERE id = $4 RETURNING *`,
    [input.name, input.buildingName, input.unitNumber, id]
  );
  return rows[0] ?? null;
}
