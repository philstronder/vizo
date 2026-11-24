import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { createCondominium } from "../../src/db/condominiums";
import { pool } from "../../src/db/pool";
import { setUserAdmin } from "../../src/db/users";
import { AUTH_COOKIE_NAME } from "../../src/lib/jwt";

// Sign-up, sign-in and profile edits against the real users table (the unit
// tests mock these queries).

const ADDRESS = {
  postalCode: "01310-100",
  street: "Avenida Paulista",
  number: "1000",
  district: "Bela Vista",
  city: "São Paulo",
  state: "SP",
};

const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

const resident = {
  name: "Ana Souza",
  email: "ana@example.com",
  password: "secret123",
  unitNumber: "42",
  buildingBlock: "B",
  buildingName: "edifício aurora",
  proofPhoto: PHOTO,
};

beforeEach(async () => {
  await createCondominium("Edifício Aurora", ADDRESS);
  await createCondominium("Torre Boreal", ADDRESS);
});

const cookieOf = (res: request.Response) =>
  ([] as string[]).concat(res.headers["set-cookie"] ?? []).find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`))!.split(";")[0];

describe("accounts", () => {
  it("registers a resident, stores a password hash, and signs them in", async () => {
    const res = await request(app).post("/api/auth/register").send(resident);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Ana Souza",
      buildingName: "Edifício Aurora", // the list's spelling
      buildingBlock: "B",
      unitNumber: "42",
      verified: false, // until a building admin approves the proof of residency
      verificationStatus: "pending",
      isAdmin: false,
      buildingAdminOf: [],
    });

    const { rows } = await pool.query<{ password_hash: string }>("SELECT password_hash FROM users");
    expect(rows[0].password_hash).not.toContain("secret123");

    const me = await request(app).get("/api/auth/me").set("Cookie", cookieOf(res));
    expect(me.body).toMatchObject({ email: "ana@example.com" });
  });

  it("refuses a second account with the same email", async () => {
    await request(app).post("/api/auth/register").send(resident);
    expect((await request(app).post("/api/auth/register").send(resident)).status).toBe(409);
  });

  it("adds a missing condominium at sign-up, but not one that's already listed", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...resident, buildingName: undefined, newCondominium: { name: "Solar", address: ADDRESS } });
    expect(res.body.buildingName).toBe("Solar");
    expect((await request(app).get("/api/condominiums")).body.map((c: { name: string }) => c.name)).toContain("Solar");

    const dup = await request(app)
      .post("/api/auth/register")
      .send({ ...resident, email: "other@example.com", buildingName: undefined, newCondominium: { name: " solar", address: ADDRESS } });
    expect(dup.status).toBe(409);
  });

  it("registers a TV store viewer with a phone and delivery address", async () => {
    const res = await request(app).post("/api/auth/register").send({
      accountType: "viewer",
      name: "Carla",
      email: "carla@example.com",
      password: "secret123",
      phone: "(11) 91234-5678",
      deliveryAddress: { ...ADDRESS, complement: "Apt 4" },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ phone: "(11) 91234-5678", deliveryAddress: { ...ADDRESS, complement: "Apt 4" } });
    expect(res.body.buildingName).toBeUndefined();
    expect(res.body.verificationStatus).toBe("approved"); // nothing to prove
  });

  it("signs in with the right password only", async () => {
    await request(app).post("/api/auth/register").send(resident);
    const ok = await request(app).post("/api/auth/login").send({ email: resident.email, password: "secret123" });
    expect(ok.status).toBe(200);
    expect(cookieOf(ok)).toBeTruthy();
    expect((await request(app).post("/api/auth/login").send({ email: resident.email, password: "nope" })).status).toBe(401);
  });

  it("reports admin status once granted", async () => {
    const res = await request(app).post("/api/auth/register").send(resident);
    await setUserAdmin(resident.email, true);
    expect((await request(app).get("/api/auth/me").set("Cookie", cookieOf(res))).body.isAdmin).toBe(true);
  });

  describe("PATCH /api/auth/me", () => {
    let cookie: string;
    beforeEach(async () => {
      cookie = cookieOf(await request(app).post("/api/auth/register").send(resident));
    });
    const patch = (body: object) => request(app).patch("/api/auth/me").set("Cookie", cookie).send(body);

    it("renames without touching the building or unit", async () => {
      const res = await patch({ name: "Ana S." });
      expect(res.body).toMatchObject({ name: "Ana S.", buildingName: "Edifício Aurora", unitNumber: "42", buildingBlock: "B" });
    });

    it("moves to another listed condominium with a new proof, using the list's spelling", async () => {
      await pool.query("UPDATE users SET verified = TRUE");
      const move = { name: "Ana", buildingName: "torre boreal", unitNumber: "7" };
      expect((await patch(move)).body.code).toBe("residency_proof_required");

      const res = await patch({ ...move, proofPhoto: PHOTO });
      expect(res.body).toMatchObject({ buildingName: "Torre Boreal", unitNumber: "7", verificationStatus: "pending" });
    });

    it("clears the block with an empty string, and keeps it when omitted", async () => {
      expect((await patch({ name: "Ana", buildingBlock: "" })).body.buildingBlock).toBeUndefined();
      expect((await patch({ name: "Ana", buildingBlock: "C" })).body.buildingBlock).toBe("C");
      expect((await patch({ name: "Ana" })).body.buildingBlock).toBe("C");
    });

    it("saves a phone and delivery address, keeping them when omitted", async () => {
      await patch({ name: "Ana", phone: "(11) 99999-0000", deliveryAddress: ADDRESS });
      const res = await patch({ name: "Ana" });
      expect(res.body).toMatchObject({ phone: "(11) 99999-0000", deliveryAddress: ADDRESS });
    });

    it("refuses unlisted condominiums and a blank name", async () => {
      expect((await patch({ name: "Ana", buildingName: "Nowhere", unitNumber: "1" })).status).toBe(400);
      expect((await patch({ name: " " })).status).toBe(400);
    });
  });
});
