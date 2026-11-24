import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { as, getEmail, getListing, insertListing, insertStore, insertUser } from "./factories";

let admin: string;
let resident: string;

beforeEach(async () => {
  admin = await insertUser({ name: "Admin", isAdmin: true });
  resident = await insertUser({ name: "Resident" });
});

const ADDRESS = {
  postalCode: "01310-100",
  street: "Avenida Paulista",
  number: "1000",
  district: "Bela Vista",
  city: "São Paulo",
  state: "SP",
};

// Every admin endpoint answers 401 signed out and 403 to non-admins.
describe.each([
  ["get", "/api/stores"],
  ["post", "/api/stores"],
  ["patch", "/api/stores/00000000-0000-4000-8000-000000000999"],
  ["delete", "/api/stores/00000000-0000-4000-8000-000000000999"],
  ["get", "/api/admins"],
  ["post", "/api/admins"],
  ["delete", "/api/admins/00000000-0000-4000-8000-000000000999"],
  ["post", "/api/condominiums"],
  ["delete", "/api/condominiums/00000000-0000-4000-8000-000000000999"],
] as const)("%s %s", (method, path) => {
  it("is admin-only", async () => {
    expect((await request(app)[method](path)).status).toBe(401);
    expect((await request(app)[method](path).set("Cookie", as(resident))).status).toBe(403);
  });
});

describe("stores", () => {
  const post = (body: object) => request(app).post("/api/stores").set("Cookie", as(admin)).send(body);

  it("creates, lists, renames and deletes a store", async () => {
    const created = await post({ name: "  Morning Show ", description: "Kitchen gadgets" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: "Morning Show", description: "Kitchen gadgets", productCount: 0 });
    const id = created.body.id;

    const list = await request(app).get("/api/stores").set("Cookie", as(admin));
    expect(list.body.map((s: { id: string }) => s.id)).toEqual([id]);

    const renamed = await request(app)
      .patch(`/api/stores/${id}`)
      .set("Cookie", as(admin))
      .send({ name: "Evening Show" });
    expect(renamed.body).toMatchObject({ name: "Evening Show", description: "" });

    expect((await request(app).delete(`/api/stores/${id}`).set("Cookie", as(admin))).status).toBe(204);
    expect((await request(app).get(`/api/stores/${id}`)).status).toBe(404);
    expect((await request(app).get("/api/stores").set("Cookie", as(admin))).body).toEqual([]);
    expect((await request(app).delete(`/api/stores/${id}`).set("Cookie", as(admin))).status).toBe(404);
    expect((await request(app).patch(`/api/stores/${id}`).set("Cookie", as(admin)).send({ name: "x" })).status).toBe(404);
  });

  it("validates the name", async () => {
    expect((await post({ name: "  " })).status).toBe(400);
    expect((await post({ name: "Show", description: "x".repeat(2001) })).status).toBe(400);
  });

  it("shows a single store to anyone, counting only products on sale", async () => {
    const store = await insertStore(admin);
    await insertListing(admin, { storeId: store });
    await insertListing(admin, { storeId: store });
    await insertListing(admin, { storeId: store, status: "sold" });
    const res = await request(app).get(`/api/stores/${store}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: store, productCount: 2 });
  });

  it("takes unsold products off sale when the store is deleted, keeping sold ones", async () => {
    const store = await insertStore(admin);
    const onSale = await insertListing(admin, { storeId: store });
    const sold = await insertListing(admin, { storeId: store, status: "sold" });
    await request(app).delete(`/api/stores/${store}`).set("Cookie", as(admin));
    expect((await getListing(onSale)).status).toBe("ended");
    expect((await getListing(sold)).status).toBe("sold");
  });
});

describe("admins", () => {
  it("lists admins without their password hashes", async () => {
    const res = await request(app).get("/api/admins").set("Cookie", as(admin));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: admin, name: "Admin", isAdmin: true })]);
    expect(res.body[0]).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(res.body)).not.toContain("password");
  });

  it("promotes an existing account by email", async () => {
    const res = await request(app)
      .post("/api/admins")
      .set("Cookie", as(admin))
      .send({ email: await getEmail(resident) });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: resident, isAdmin: true });
    // The new admin can now use admin endpoints.
    expect((await request(app).get("/api/admins").set("Cookie", as(resident))).body).toHaveLength(2);
  });

  it("asks unknown people to sign up first", async () => {
    const res = await request(app).post("/api/admins").set("Cookie", as(admin)).send({ email: "nobody@example.com" });
    expect(res.status).toBe(404);
    expect((await request(app).post("/api/admins").set("Cookie", as(admin)).send({ email: "not-an-email" })).status).toBe(
      400
    );
  });

  it("revokes another admin, but never yourself", async () => {
    const other = await insertUser({ isAdmin: true });
    expect((await request(app).delete(`/api/admins/${other}`).set("Cookie", as(admin))).status).toBe(204);
    expect((await request(app).get("/api/stores").set("Cookie", as(other))).status).toBe(403);

    const self = await request(app).delete(`/api/admins/${admin}`).set("Cookie", as(admin));
    expect(self.status).toBe(400);
    expect((await request(app).get("/api/admins").set("Cookie", as(admin))).status).toBe(200);
  });
});

describe("condominiums", () => {
  const add = (body: object) => request(app).post("/api/condominiums").set("Cookie", as(admin)).send(body);

  it("lists condominiums publicly, sorted by name, with their address", async () => {
    await add({ name: "Zênite", address: ADDRESS });
    await add({ name: "Aurora", address: ADDRESS });
    const res = await request(app).get("/api/condominiums");
    expect(res.status).toBe(200);
    expect(res.body.map((c: { name: string }) => c.name)).toEqual(["Aurora", "Zênite"]);
    expect(res.body[0].address).toMatchObject({ city: "São Paulo", street: "Avenida Paulista" });
  });

  it("refuses duplicates, ignoring case and spaces", async () => {
    expect((await add({ name: "Aurora", address: ADDRESS })).status).toBe(201);
    expect((await add({ name: "  AURORA ", address: ADDRESS })).status).toBe(409);
  });

  it("requires a full address", async () => {
    expect((await add({ name: "Aurora", address: { ...ADDRESS, city: "" } })).status).toBe(400);
    expect((await add({ name: "Aurora" })).status).toBe(400);
  });

  it("removes a condominium from the list without moving its residents", async () => {
    const { body } = await add({ name: "Aurora", address: ADDRESS });
    expect((await request(app).delete(`/api/condominiums/${body.id}`).set("Cookie", as(admin))).status).toBe(204);
    expect((await request(app).get("/api/condominiums")).body).toEqual([]);
    expect((await request(app).delete(`/api/condominiums/${body.id}`).set("Cookie", as(admin))).status).toBe(404);

    const me = await request(app).get("/api/auth/me").set("Cookie", as(resident));
    expect(me.body.buildingName).toBe("Aurora");
  });
});
