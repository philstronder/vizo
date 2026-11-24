import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { pool } from "../../src/db/pool";
import {
  PROOF_PHOTO,
  as,
  getEmail,
  insertCondominium,
  insertListing,
  insertPendingResident,
  insertUser,
  notificationsOf,
} from "./factories";

// Building admins, nominated by platform admins, review the proofs of
// residency of people signing up to their condominium. Residents can't use
// their community until theirs is approved.

let admin: string;
let aurora: string;
let boreal: string;
let manager: string; // building admin of Aurora

beforeEach(async () => {
  admin = await insertUser({ name: "Admin", isAdmin: true });
  aurora = await insertCondominium("Aurora");
  boreal = await insertCondominium("Boreal");
  manager = await insertUser({ name: "Manager", buildingName: null });
  await pool.query("INSERT INTO building_admins (user_id, condominium_id) VALUES ($1, $2)", [manager, aurora]);
});

const queue = (userId: string) => request(app).get("/api/residency-requests").set("Cookie", as(userId));
const approve = (reviewer: string, resident: string) =>
  request(app).post(`/api/residency-requests/${resident}/approve`).set("Cookie", as(reviewer));
const reject = (reviewer: string, resident: string, reason?: string) =>
  request(app)
    .post(`/api/residency-requests/${resident}/reject`)
    .set("Cookie", as(reviewer))
    .send(reason === undefined ? {} : { reason });
const me = async (userId: string) => (await request(app).get("/api/auth/me").set("Cookie", as(userId))).body;

describe("building admins", () => {
  it.each([
    ["get", "/api/building-admins"],
    ["post", "/api/building-admins"],
    ["delete", "/api/building-admins/00000000-0000-4000-8000-000000000998/00000000-0000-4000-8000-000000000999"],
  ] as const)("%s %s is for platform admins only", async (method, path) => {
    expect((await request(app)[method](path)).status).toBe(401);
    expect((await request(app)[method](path).set("Cookie", as(manager))).status).toBe(403);
  });

  it("nominates an existing account for a condominium, and lists them", async () => {
    const resident = await insertUser({ name: "Bia" });
    const res = await request(app)
      .post("/api/building-admins")
      .set("Cookie", as(admin))
      .send({ email: await getEmail(resident), condominiumId: boreal });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ user: { id: resident, name: "Bia" }, condominium: { id: boreal, name: "Boreal" } });

    // Nominating twice changes nothing.
    await request(app)
      .post("/api/building-admins")
      .set("Cookie", as(admin))
      .send({ email: await getEmail(resident), condominiumId: boreal });
    const list = await request(app).get("/api/building-admins").set("Cookie", as(admin));
    expect(list.body.map((b: { user: { name: string }; condominium: { name: string } }) => [b.condominium.name, b.user.name])).toEqual([
      ["Aurora", "Manager"],
      ["Boreal", "Bia"],
    ]);
    expect(JSON.stringify(list.body)).not.toContain("password");

    expect((await me(resident)).buildingAdminOf).toEqual([{ id: boreal, name: "Boreal" }]);
  });

  it("asks unknown people to sign up first, and needs a listed condominium", async () => {
    const post = (body: object) => request(app).post("/api/building-admins").set("Cookie", as(admin)).send(body);
    const nobody = await post({ email: "nobody@example.com", condominiumId: aurora });
    expect(nobody.status).toBe(404);
    expect(nobody.body.code).toBe("building_admin_email_not_found");
    const noCondo = await post({ email: await getEmail(manager), condominiumId: "00000000-0000-4000-8000-000000000999" });
    expect(noCondo.body.code).toBe("condominium_not_found");
    expect((await post({ email: await getEmail(manager) })).status).toBe(400);
  });

  it("removes a building admin, who then loses the review queue", async () => {
    const del = () => request(app).delete(`/api/building-admins/${aurora}/${manager}`).set("Cookie", as(admin));
    expect((await del()).status).toBe(204);
    expect((await del()).status).toBe(404);
    expect((await me(manager)).buildingAdminOf).toEqual([]);
    expect((await queue(manager)).status).toBe(403);
  });

  it("go away with their condominium", async () => {
    await request(app).delete(`/api/condominiums/${aurora}`).set("Cookie", as(admin));
    expect((await request(app).get("/api/building-admins").set("Cookie", as(admin))).body).toEqual([]);
  });
});

describe("a pending resident", () => {
  it("can't see or use their community until approved", async () => {
    const neighbor = await insertUser({ buildingName: "Aurora" });
    const listing = await insertListing(neighbor);
    const pending = await insertPendingResident("Aurora");

    expect(await me(pending)).toMatchObject({ verified: false, verificationStatus: "pending" });
    for (const res of [
      await request(app).get("/api/listings").set("Cookie", as(pending)),
      await request(app).get(`/api/listings/${listing}`).set("Cookie", as(pending)),
      await request(app)
        .post("/api/listings")
        .set("Cookie", as(pending))
        .send({ title: "Lamp", description: "A lamp", category: "other", condition: "used-good", type: "direct", price: 10 }),
      await request(app)
        .post("/api/orders")
        .set("Cookie", as(pending))
        .send({ listingId: listing, meetupAt: new Date(Date.now() + 86_400_000).toISOString() }),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("residency_not_verified");
    }

    // Other buildings' listings still 404, as for anyone.
    const elsewhere = await insertListing(await insertUser({ buildingName: "Boreal" }));
    expect((await request(app).get(`/api/listings/${elsewhere}`).set("Cookie", as(pending))).status).toBe(404);

    expect((await approve(manager, pending)).status).toBe(204);
    expect((await request(app).get("/api/listings").set("Cookie", as(pending))).status).toBe(200);
    expect((await request(app).get(`/api/listings/${listing}`).set("Cookie", as(pending))).status).toBe(200);
  });
});

describe("the review queue", () => {
  it("is only for building and platform admins", async () => {
    const resident = await insertUser();
    expect((await request(app).get("/api/residency-requests")).status).toBe(401);
    const res = await queue(resident);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("residency_reviewers_only");
    expect((await approve(resident, await insertPendingResident())).status).toBe(403);
  });

  it("shows building admins their condominiums' requests, with the photo, and platform admins every one", async () => {
    const ana = await insertPendingResident(" aurora ", "Ana");
    const bruno = await insertPendingResident("Boreal", "Bruno");
    await insertUser({ buildingName: "Aurora" }); // already verified

    const mine = await queue(manager);
    expect(mine.status).toBe(200);
    expect(mine.body).toEqual([
      expect.objectContaining({ userId: ana, name: "Ana", buildingName: " aurora ", unitNumber: "1", proofPhoto: PROOF_PHOTO }),
    ]);
    expect((await queue(admin)).body.map((r: { userId: string }) => r.userId).sort()).toEqual([ana, bruno].sort());
  });

  it("approves a request, discarding the photo and welcoming the resident", async () => {
    const ana = await insertPendingResident("Aurora");
    expect((await approve(manager, ana)).status).toBe(204);

    expect(await me(ana)).toMatchObject({ verified: true, verificationStatus: "approved" });
    const { rows } = await pool.query("SELECT verification_photo_key, verification_reviewed_by FROM users WHERE id = $1", [ana]);
    expect(rows[0]).toEqual({ verification_photo_key: null, verification_reviewed_by: manager });
    expect(await notificationsOf(ana)).toEqual([expect.objectContaining({ type: "residency_approved" })]);
    expect((await queue(manager)).body).toEqual([]);

    // Already reviewed.
    expect((await approve(manager, ana)).status).toBe(404);
    expect((await reject(manager, ana)).status).toBe(404);
  });

  it("rejects with a reason, and takes the request back once a new photo is sent", async () => {
    const ana = await insertPendingResident("Aurora");
    expect((await reject(manager, ana, "  The bill is from another address ")).status).toBe(204);

    expect(await me(ana)).toMatchObject({
      verified: false,
      verificationStatus: "rejected",
      verificationRejectionReason: "The bill is from another address",
    });
    expect(await notificationsOf(ana)).toEqual([expect.objectContaining({ type: "residency_rejected" })]);
    expect((await queue(manager)).body).toEqual([]);
    expect((await request(app).get("/api/listings").set("Cookie", as(ana))).status).toBe(403);

    const resubmit = await request(app)
      .put("/api/auth/me/residency-proof")
      .set("Cookie", as(ana))
      .send({ proofPhoto: PROOF_PHOTO });
    expect(resubmit.status).toBe(200);
    expect(resubmit.body).toMatchObject({ verificationStatus: "pending" });
    expect(resubmit.body.verificationRejectionReason).toBeUndefined();
    expect((await queue(manager)).body.map((r: { userId: string }) => r.userId)).toEqual([ana]);
    expect(await notificationsOf(manager)).toEqual([expect.objectContaining({ type: "residency_submitted" })]);
  });

  it("caps the rejection reason", async () => {
    const ana = await insertPendingResident("Aurora");
    expect((await reject(manager, ana, "x".repeat(501))).status).toBe(400);
  });

  it("keeps building admins out of other condominiums, and everyone out of their own request", async () => {
    const bruno = await insertPendingResident("Boreal");
    const res = await approve(manager, bruno);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("residency_request_not_found");
    expect((await me(bruno)).verified).toBe(false);

    // A pending resident nominated as their own building's admin.
    const carla = await insertPendingResident("Aurora");
    await pool.query("INSERT INTO building_admins (user_id, condominium_id) VALUES ($1, $2)", [carla, aurora]);
    expect((await queue(carla)).body).toEqual([]);
    const own = await approve(carla, carla);
    expect(own.status).toBe(403);
    expect(own.body.code).toBe("cannot_review_own_residency");

    // Platform admins review any building's, e.g. one with no building admin.
    expect((await approve(admin, bruno)).status).toBe(204);
  });

  it("turns away unknown ids and malformed ones", async () => {
    expect((await approve(manager, "00000000-0000-4000-8000-000000000999")).status).toBe(404);
    expect((await approve(manager, "not-a-uuid")).status).toBe(400);
  });
});

describe("new requests", () => {
  const signUp = (buildingName: string, email: string) =>
    request(app).post("/api/auth/register").send({
      name: "Dora",
      email,
      password: "secret123",
      unitNumber: "3",
      buildingName,
      proofPhoto: PROOF_PHOTO,
    });

  it("notify the condominium's building admins", async () => {
    const res = await signUp("aurora", "dora@example.com");
    expect(res.body.verificationStatus).toBe("pending");
    expect(await notificationsOf(manager)).toEqual([expect.objectContaining({ type: "residency_submitted" })]);
    expect(await notificationsOf(admin)).toEqual([]);
  });

  it("notify platform admins when the condominium has no building admin", async () => {
    await signUp("Boreal", "dora@example.com");
    expect(await notificationsOf(admin)).toEqual([expect.objectContaining({ type: "residency_submitted" })]);
    expect(await notificationsOf(manager)).toEqual([]);
  });

  it("can't be resubmitted once verified, or without a building", async () => {
    const verified = await insertUser();
    const viewer = await insertUser({ buildingName: null });
    const put = (userId: string) =>
      request(app).put("/api/auth/me/residency-proof").set("Cookie", as(userId)).send({ proofPhoto: PROOF_PHOTO });
    expect((await put(verified)).body.code).toBe("residency_already_verified");
    expect((await put(viewer)).body.code).toBe("tv_account_no_community");
    expect((await request(app).put("/api/auth/me/residency-proof").set("Cookie", as(verified)).send({})).status).toBe(400);
  });

  it("are made when a viewer joins a building", async () => {
    const viewer = await insertUser({ buildingName: null });
    const join = { name: "Vera", buildingName: "Aurora", unitNumber: "9" };
    const patch = (body: object) => request(app).patch("/api/auth/me").set("Cookie", as(viewer)).send(body);
    expect((await patch(join)).body.code).toBe("residency_proof_required");
    const res = await patch({ ...join, proofPhoto: PROOF_PHOTO });
    expect(res.body).toMatchObject({ buildingName: "Aurora", verificationStatus: "pending" });
    expect((await queue(manager)).body.map((r: { userId: string }) => r.userId)).toEqual([viewer]);
  });
});
