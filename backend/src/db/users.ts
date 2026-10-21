import { pool } from "./pool";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  building_name: string | null; // null for TV store viewer accounts
  unit_number: string | null;
  phone: string | null;
  address_postal_code: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_district: string | null;
  address_city: string | null;
  address_state: string | null;
  verified: boolean;
  is_admin: boolean;
  created_at: Date;
}

export interface DeliveryAddress {
  postalCode: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
}

// Rows carrying the address_* columns, either a user or an order's buyer.
type AddressColumns = Pick<
  UserRow,
  | "address_postal_code"
  | "address_street"
  | "address_number"
  | "address_complement"
  | "address_district"
  | "address_city"
  | "address_state"
>;

export function toDeliveryAddress(row: AddressColumns): DeliveryAddress | undefined {
  if (row.address_street === null) return undefined;
  return {
    postalCode: row.address_postal_code ?? "",
    street: row.address_street,
    number: row.address_number ?? "",
    complement: row.address_complement ?? undefined,
    district: row.address_district ?? "",
    city: row.address_city ?? "",
    state: row.address_state ?? "",
  };
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  buildingName?: string;
  unitNumber?: string;
  phone?: string;
  deliveryAddress?: DeliveryAddress;
  verified: boolean;
  isAdmin: boolean;
  memberSince: string;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    buildingName: row.building_name ?? undefined,
    unitNumber: row.unit_number ?? undefined,
    phone: row.phone ?? undefined,
    deliveryAddress: toDeliveryAddress(row),
    verified: row.verified,
    isAdmin: row.is_admin,
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
  // Building residents give a building and unit; TV store viewers give a
  // phone and delivery address instead.
  buildingName?: string;
  unitNumber?: string;
  phone?: string;
  deliveryAddress?: DeliveryAddress;
  // Address verification is a manual/async review step in a real deployment
  // (an admin or a document-verification API confirms the uploaded proof).
  // We mark accounts verified immediately here so the mock flow stays usable;
  // flip the default to FALSE once that review step exists.
  verified?: boolean;
}

export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (name, email, password_hash, building_name, unit_number, verified, phone,
       address_postal_code, address_street, address_number, address_complement, address_district, address_city, address_state)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      input.name,
      input.email,
      input.passwordHash,
      input.buildingName ?? null,
      input.unitNumber ?? null,
      input.verified ?? true,
      input.phone ?? null,
      ...addressParams(input.deliveryAddress),
    ]
  );
  return rows[0];
}

function addressParams(address: DeliveryAddress | undefined) {
  return [
    address?.postalCode ?? null,
    address?.street ?? null,
    address?.number ?? null,
    address?.complement || null,
    address?.district ?? null,
    address?.city ?? null,
    address?.state ?? null,
  ];
}

// Omitted fields keep their saved value; a building can be added but not removed.
export interface UpdateUserInput {
  name: string;
  buildingName?: string;
  unitNumber?: string;
  phone?: string;
  deliveryAddress?: DeliveryAddress;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<UserRow | null> {
  const address = input.deliveryAddress;
  const { rows } = await pool.query<UserRow>(
    `UPDATE users SET
       name = $1,
       building_name = COALESCE($2, building_name),
       unit_number = COALESCE($3, unit_number),
       phone = COALESCE($4, phone),
       address_postal_code = CASE WHEN $6::boolean THEN $7 ELSE address_postal_code END,
       address_street = CASE WHEN $6::boolean THEN $8 ELSE address_street END,
       address_number = CASE WHEN $6::boolean THEN $9 ELSE address_number END,
       address_complement = CASE WHEN $6::boolean THEN $10 ELSE address_complement END,
       address_district = CASE WHEN $6::boolean THEN $11 ELSE address_district END,
       address_city = CASE WHEN $6::boolean THEN $12 ELSE address_city END,
       address_state = CASE WHEN $6::boolean THEN $13 ELSE address_state END
     WHERE id = $5 RETURNING *`,
    [
      input.name,
      input.buildingName ?? null,
      input.unitNumber ?? null,
      input.phone ?? null,
      id,
      address !== undefined,
      ...addressParams(address),
    ]
  );
  return rows[0] ?? null;
}

export async function setUserAdmin(email: string, isAdmin: boolean): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    "UPDATE users SET is_admin = $1 WHERE email = $2 RETURNING *",
    [isAdmin, email]
  );
  return rows[0] ?? null;
}

// Building names are typed in freely at sign-up, so communities are matched
// case- and whitespace-insensitively. Accounts without a building (TV store
// viewers) belong to no community.
export function sameBuilding(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function listAdmins(): Promise<UserRow[]> {
  const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE is_admin ORDER BY name");
  return rows;
}

export async function setUserAdminById(id: string, isAdmin: boolean): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    "UPDATE users SET is_admin = $1 WHERE id = $2 RETURNING *",
    [isAdmin, id]
  );
  return rows[0] ?? null;
}
