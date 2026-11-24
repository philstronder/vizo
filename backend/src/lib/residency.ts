import { createNotification } from "../db/notifications";
import { buildingAdminIdsFor, condominiumsAdministeredBy, isBuildingAdminOf } from "../db/residency";
import { isCommunityMember, listAdmins, toPublicUser, type UserRow } from "../db/users";
import { forbidden } from "./http-error";

// The signed-in user as the app sees them: their profile plus the
// condominiums they review residents for, so the UI knows to show the queue.
export async function toSessionUser(row: UserRow) {
  return { ...toPublicUser(row), buildingAdminOf: await condominiumsAdministeredBy(row.id) };
}

// Community features need a building and an approved proof of residency.
// Callers have already turned away accounts without a building.
export function assertVerifiedResident(row: UserRow) {
  if (row.building_name !== null && !isCommunityMember(row)) throw forbidden("residency_not_verified");
}

// Platform admins review any building (a condominium added at sign-up has no
// building admin yet); building admins review their condominiums. Nobody
// reviews their own request.
export async function canReviewResidency(reviewer: UserRow, resident: UserRow): Promise<boolean> {
  if (reviewer.id === resident.id || resident.building_name === null) return false;
  if (reviewer.is_admin) return true;
  return isBuildingAdminOf(reviewer.id, resident.building_name);
}

// Tells the building's admins there's a new proof to review, or the platform
// admins when the building has none.
export async function notifyResidencySubmitted(resident: UserRow) {
  if (resident.building_name === null) return;
  let reviewerIds = await buildingAdminIdsFor(resident.building_name);
  if (reviewerIds.length === 0) reviewerIds = (await listAdmins()).map((a) => a.id);
  const buildingName = resident.building_name;
  await Promise.all(
    reviewerIds
      .filter((id) => id !== resident.id)
      .map((userId) =>
        createNotification({
          userId,
          type: "residency_submitted",
          title: `${resident.name} wants to join ${buildingName}`,
          body: "Review their proof of residency.",
          href: "/verifications",
          params: { actorName: resident.name, buildingName },
        })
      )
  );
}

export async function notifyResidencyReviewed(resident: UserRow) {
  const buildingName = resident.building_name ?? "";
  await createNotification(
    resident.verified
      ? {
          userId: resident.id,
          type: "residency_approved",
          title: `Welcome to ${buildingName}`,
          body: "Your proof of residency was approved. You can now buy and sell with your neighbors.",
          href: "/",
          params: { buildingName },
        }
      : {
          userId: resident.id,
          type: "residency_rejected",
          title: "Proof of residency not approved",
          body: resident.verification_rejection_reason
            ? `Reason: ${resident.verification_rejection_reason}. Send a new photo to try again.`
            : "Send a new photo to try again.",
          href: "/",
          params: { buildingName, reason: resident.verification_rejection_reason ?? undefined },
        }
  );
}
