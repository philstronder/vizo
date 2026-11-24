import { pool } from "./pool";
import type { UserRow } from "./users";

// Building admins and the proof-of-residency review they do. Residents belong
// to a condominium by name (users.building_name, matched ignoring case and
// surrounding spaces), so that's how a request finds its reviewers.

export interface CondominiumRef {
  id: string;
  name: string;
}

export interface BuildingAdminRow {
  user_id: string;
  user_name: string;
  user_email: string;
  condominium_id: string;
  condominium_name: string;
  created_at: Date;
}

export function toApiBuildingAdmin(row: BuildingAdminRow) {
  return {
    user: { id: row.user_id, name: row.user_name, email: row.user_email },
    condominium: { id: row.condominium_id, name: row.condominium_name },
    since: row.created_at.toISOString(),
  };
}

const BUILDING_ADMIN_SELECT = `
  SELECT ba.user_id, u.name AS user_name, u.email AS user_email,
         ba.condominium_id, c.name AS condominium_name, ba.created_at
  FROM building_admins ba
  JOIN users u ON u.id = ba.user_id
  JOIN condominiums c ON c.id = ba.condominium_id`;

export async function listBuildingAdmins(): Promise<BuildingAdminRow[]> {
  const { rows } = await pool.query<BuildingAdminRow>(`${BUILDING_ADMIN_SELECT} ORDER BY c.name, u.name`);
  return rows;
}

// Nominating someone twice for the same condominium is a no-op.
export async function addBuildingAdmin(
  userId: string,
  condominiumId: string,
  createdBy: string
): Promise<BuildingAdminRow> {
  await pool.query(
    `INSERT INTO building_admins (user_id, condominium_id, created_by) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [userId, condominiumId, createdBy]
  );
  const { rows } = await pool.query<BuildingAdminRow>(
    `${BUILDING_ADMIN_SELECT} WHERE ba.user_id = $1 AND ba.condominium_id = $2`,
    [userId, condominiumId]
  );
  return rows[0];
}

export async function removeBuildingAdmin(userId: string, condominiumId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "DELETE FROM building_admins WHERE user_id = $1 AND condominium_id = $2",
    [userId, condominiumId]
  );
  return (rowCount ?? 0) > 0;
}

// The condominiums someone reviews residents for.
export async function condominiumsAdministeredBy(userId: string): Promise<CondominiumRef[]> {
  const { rows } = await pool.query<CondominiumRef>(
    `SELECT c.id, c.name FROM building_admins ba
     JOIN condominiums c ON c.id = ba.condominium_id
     WHERE ba.user_id = $1 ORDER BY c.name`,
    [userId]
  );
  return rows;
}

export async function isBuildingAdminOf(userId: string, buildingName: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM building_admins ba
     JOIN condominiums c ON c.id = ba.condominium_id
     WHERE ba.user_id = $1 AND lower(trim(c.name)) = lower(trim($2))`,
    [userId, buildingName]
  );
  return rows.length > 0;
}

// Who gets told about a new request for this building.
export async function buildingAdminIdsFor(buildingName: string): Promise<string[]> {
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT ba.user_id FROM building_admins ba
     JOIN condominiums c ON c.id = ba.condominium_id
     WHERE lower(trim(c.name)) = lower(trim($1))`,
    [buildingName]
  );
  return rows.map((r) => r.user_id);
}

export type PendingResidentRow = Pick<
  UserRow,
  | "id"
  | "name"
  | "email"
  | "building_name"
  | "building_block"
  | "unit_number"
  | "verification_photo_key"
  | "verification_submitted_at"
>;

export function toApiResidencyRequest(row: PendingResidentRow) {
  return {
    userId: row.id,
    name: row.name,
    email: row.email,
    buildingName: row.building_name!,
    buildingBlock: row.building_block ?? undefined,
    unitNumber: row.unit_number ?? undefined,
    proofPhoto: row.verification_photo_key ?? undefined,
    submittedAt: (row.verification_submitted_at ?? new Date()).toISOString(),
  };
}

// Requests waiting for review, oldest first. Platform admins see every
// building's (`reviewerId` undefined); building admins only their own.
// Rejected requests drop out until the resident sends a new photo.
export async function listPendingResidents(reviewerId?: string): Promise<PendingResidentRow[]> {
  const { rows } = await pool.query<PendingResidentRow>(
    `SELECT u.id, u.name, u.email, u.building_name, u.building_block, u.unit_number,
            u.verification_photo_key, u.verification_submitted_at
     FROM users u
     WHERE NOT u.verified AND u.building_name IS NOT NULL AND u.verification_reviewed_at IS NULL
       AND ($1::uuid IS NULL OR EXISTS (
         SELECT 1 FROM building_admins ba
         JOIN condominiums c ON c.id = ba.condominium_id
         WHERE ba.user_id = $1 AND lower(trim(c.name)) = lower(trim(u.building_name))
       ))
     ORDER BY u.verification_submitted_at NULLS FIRST, u.created_at`,
    [reviewerId ?? null]
  );
  return rows;
}

// Records the decision on a pending request and discards the photo, which
// isn't needed once reviewed. Returns null when the request isn't pending
// (already reviewed, or never sent).
export async function reviewResidency(
  userId: string,
  reviewerId: string,
  decision: { approved: true } | { approved: false; reason?: string }
): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `UPDATE users SET
       verified = $3,
       verification_reviewed_at = now(),
       verification_reviewed_by = $2,
       verification_rejection_reason = $4,
       verification_photo_key = NULL
     WHERE id = $1 AND NOT verified AND building_name IS NOT NULL AND verification_reviewed_at IS NULL
     RETURNING *`,
    [userId, reviewerId, decision.approved, decision.approved ? null : decision.reason || null]
  );
  return rows[0] ?? null;
}

// A new photo after a rejection (or a replacement while waiting) puts the
// request back in the queue. Verified residents have nothing to resubmit.
export async function resubmitResidencyProof(userId: string, photo: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `UPDATE users SET
       verification_photo_key = $2,
       verification_submitted_at = now(),
       verification_reviewed_at = NULL,
       verification_reviewed_by = NULL,
       verification_rejection_reason = NULL
     WHERE id = $1 AND NOT verified AND building_name IS NOT NULL
     RETURNING *`,
    [userId, photo]
  );
  return rows[0] ?? null;
}
