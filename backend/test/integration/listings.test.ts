import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { placeBidTx } from "../../src/db/listings";
import { pool } from "../../src/db/pool";
import { as, getListing, insertListing, insertStore, insertUser, notificationsOf } from "./factories";

let seller: string;
let neighbor: string;
let outsider: string;

beforeEach(async () => {
  seller = await insertUser({ name: "Bruno" });
  neighbor = await insertUser({ name: "Ana" });
  outsider = await insertUser({ name: "Carla", buildingName: "Boreal" });
});

const directListing = {
  title: "Oak desk",
  description: "Solid oak",
  category: "furniture",
  condition: "used-good",
  type: "direct",
  price: 120,
};

const create = (userId: string, body: object) =>
  request(app).post("/api/listings").set("Cookie", as(userId)).send(body);

describe("POST /api/listings", () => {
  it("requires a session", async () => {
    expect((await request(app).post("/api/listings").send(directListing)).status).toBe(401);
  });

  it("creates a direct sale in the seller's community", async () => {
    const res = await create(seller, directListing);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: "Oak desk",
      type: "direct",
      status: "active",
      price: 120,
      quantity: 1,
      sellerId: seller,
      sellerBuildingName: "Aurora",
    });
    expect(res.body.storeId).toBeUndefined();
  });

  it("starts an auction that ends after the chosen number of days", async () => {
    const before = Date.now();
    const res = await create(seller, {
      ...directListing,
      type: "auction",
      price: undefined,
      startingPrice: 40,
      auctionDurationDays: 7,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: "auction", startingPrice: 40, bidCount: 0 });
    const endsIn = new Date(res.body.auctionEndsAt).getTime() - before;
    expect(endsIn).toBeGreaterThan(7 * 86_400_000 - 60_000);
    expect(endsIn).toBeLessThan(7 * 86_400_000 + 60_000);
  });

  it.each([
    ["a direct sale without a price", { price: undefined }],
    ["an auction without a starting price", { type: "auction", price: undefined }],
    ["a blank title", { title: "  " }],
    ["an unknown category", { category: "weapons" }],
    ["a zero price", { price: 0 }],
    ["more than five photos", { images: ["a", "b", "c", "d", "e", "f"] }],
    ["several units of a community item", { quantity: 3 }],
  ])("rejects %s", async (_label, override) => {
    expect((await create(seller, { ...directListing, ...override })).status).toBe(400);
  });

  it("doesn't let TV store viewers list in a community", async () => {
    const viewer = await insertUser({ buildingName: null });
    expect((await create(viewer, directListing)).status).toBe(403);
  });

  describe("store products", () => {
    let admin: string;
    let store: string;
    beforeEach(async () => {
      admin = await insertUser({ isAdmin: true });
      store = await insertStore(admin);
    });
    const product = () => ({ ...directListing, condition: "new", storeId: store, quantity: 10 });

    it("lets admins add stocked, new, direct-sale products", async () => {
      const res = await create(admin, product());
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ storeId: store, quantity: 10 });
    });

    it("is admin-only", async () => {
      expect((await create(seller, product())).status).toBe(403);
    });

    it("refuses used or auctioned products, and unknown stores", async () => {
      expect((await create(admin, { ...product(), condition: "used-good" })).status).toBe(400);
      expect((await create(admin, { ...product(), type: "auction", startingPrice: 5 })).status).toBe(400);
      expect((await create(admin, { ...product(), storeId: "00000000-0000-4000-8000-000000000999" })).status).toBe(404);
    });
  });
});

describe("GET /api/listings (feed)", () => {
  const feed = (userId: string, query = "") =>
    request(app).get(`/api/listings${query}`).set("Cookie", as(userId));
  const titles = (res: request.Response) => res.body.map((l: { title: string }) => l.title).sort();

  beforeEach(async () => {
    await create(seller, { ...directListing, title: "Oak desk" });
    await create(seller, { ...directListing, title: "Road bike", category: "vehicles", description: "Fast" });
    await create(seller, {
      ...directListing,
      title: "Lamp",
      description: "Vintage brass, oak base",
      type: "auction",
      price: undefined,
      startingPrice: 10,
    });
    await create(outsider, { ...directListing, title: "Boreal sofa" });
  });

  it("needs a signed-in resident", async () => {
    expect((await request(app).get("/api/listings")).status).toBe(401);
    const viewer = await insertUser({ buildingName: null });
    expect((await feed(viewer)).status).toBe(403);
  });

  it("only shows the viewer's own building, ignoring case and spaces", async () => {
    expect(titles(await feed(neighbor))).toEqual(["Lamp", "Oak desk", "Road bike"]);
    expect(titles(await feed(outsider))).toEqual(["Boreal sofa"]);
    const sloppy = await insertUser({ buildingName: "  aurora " });
    expect(titles(await feed(sloppy))).toHaveLength(3);
  });

  it("never mixes store products into a community feed", async () => {
    const admin = await insertUser({ isAdmin: true });
    await insertListing(admin, { storeId: await insertStore(admin) });
    expect(titles(await feed(admin))).toEqual(["Lamp", "Oak desk", "Road bike"]);
  });

  it("filters by search text in the title or description, category and type", async () => {
    expect(titles(await feed(neighbor, "?q=OAK"))).toEqual(["Lamp", "Oak desk"]);
    expect(titles(await feed(neighbor, "?category=vehicles"))).toEqual(["Road bike"]);
    expect(titles(await feed(neighbor, "?type=auction"))).toEqual(["Lamp"]);
    expect(titles(await feed(neighbor, "?type=direct&q=bike"))).toEqual(["Road bike"]);
  });

  it("hides sold listings unless asked, but shows a seller all of theirs", async () => {
    await pool.query("UPDATE listings SET status = 'sold' WHERE title = 'Oak desk'");
    expect(titles(await feed(neighbor))).toEqual(["Lamp", "Road bike"]);
    expect(titles(await feed(neighbor, "?status=sold"))).toEqual(["Oak desk"]);
    expect(titles(await feed(neighbor, "?status=all"))).toHaveLength(3);
    expect(titles(await feed(seller, `?sellerId=${seller}`))).toEqual(["Lamp", "Oak desk", "Road bike"]);
  });

  it("lists a store's products publicly", async () => {
    const admin = await insertUser({ isAdmin: true });
    const store = await insertStore(admin);
    await insertListing(admin, { storeId: store });
    const res = await request(app).get(`/api/listings?storeId=${store}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect((await request(app).get("/api/listings?storeId=00000000-0000-4000-8000-000000000999")).status).toBe(404);
  });
});

describe("GET /api/listings/:id", () => {
  it("shows a community listing to the seller's neighbors only", async () => {
    const id = await insertListing(seller);
    expect((await request(app).get(`/api/listings/${id}`).set("Cookie", as(neighbor))).status).toBe(200);
    expect((await request(app).get(`/api/listings/${id}`).set("Cookie", as(seller))).status).toBe(200);
    // Other buildings get a 404 so the listing's existence doesn't leak.
    expect((await request(app).get(`/api/listings/${id}`).set("Cookie", as(outsider))).status).toBe(404);
    expect((await request(app).get(`/api/listings/${id}`)).status).toBe(401);
  });

  it("shows store products to anyone", async () => {
    const admin = await insertUser({ isAdmin: true });
    const id = await insertListing(admin, { storeId: await insertStore(admin) });
    expect((await request(app).get(`/api/listings/${id}`)).status).toBe(200);
  });

  it("answers 404 for unknown and malformed ids", async () => {
    const unknown = "00000000-0000-4000-8000-000000000999";
    expect((await request(app).get(`/api/listings/${unknown}`).set("Cookie", as(seller))).status).toBe(404);
    expect((await request(app).get("/api/listings/nope").set("Cookie", as(seller))).status).toBe(404);
  });
});

describe("DELETE /api/listings/:id", () => {
  it("lets only the seller delete their listing", async () => {
    const id = await insertListing(seller);
    expect((await request(app).delete(`/api/listings/${id}`)).status).toBe(401);
    expect((await request(app).delete(`/api/listings/${id}`).set("Cookie", as(neighbor))).status).toBe(404);
    expect((await request(app).delete(`/api/listings/${id}`).set("Cookie", as(seller))).status).toBe(204);
    expect(await getListing(id)).toBeUndefined();
  });
});

describe("POST /api/listings/:id/restock", () => {
  let admin: string;
  let store: string;
  beforeEach(async () => {
    admin = await insertUser({ isAdmin: true });
    store = await insertStore(admin);
  });
  const restock = (userId: string, id: string, quantity: number) =>
    request(app).post(`/api/listings/${id}/restock`).set("Cookie", as(userId)).send({ quantity });

  it("adds units to a store product", async () => {
    const id = await insertListing(admin, { storeId: store, quantity: 2 });
    const res = await restock(admin, id, 5);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ quantity: 7, status: "active" });
  });

  it("puts a sold-out product back on sale", async () => {
    const id = await insertListing(admin, { storeId: store, quantity: 0, status: "sold" });
    expect((await restock(admin, id, 3)).body).toMatchObject({ quantity: 3, status: "active" });
  });

  it("is admin-only", async () => {
    const id = await insertListing(admin, { storeId: store });
    expect((await restock(seller, id, 3)).status).toBe(403);
    expect((await request(app).post(`/api/listings/${id}/restock`).send({ quantity: 3 })).status).toBe(401);
  });

  it("refuses community listings, deleted stores and invalid quantities", async () => {
    expect((await restock(admin, await insertListing(seller), 3)).status).toBe(404);
    const id = await insertListing(admin, { storeId: store });
    expect((await restock(admin, id, 0)).status).toBe(400);
    expect((await restock(admin, id, 1.5)).status).toBe(400);
    await pool.query("UPDATE stores SET deleted_at = now() WHERE id = $1", [store]);
    expect((await restock(admin, id, 3)).status).toBe(404);
  });
});

describe("bids", () => {
  let auction: string;
  beforeEach(async () => {
    auction = await insertListing(seller, { type: "auction" }); // starts at 10
  });
  const bid = (userId: string, amount: number, id = auction) =>
    request(app).post(`/api/listings/${id}/bids`).set("Cookie", as(userId)).send({ amount });

  it("raises the current bid, records the bidder and tells the seller", async () => {
    const res = await bid(neighbor, 15);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ currentBid: 15, maxBidderId: neighbor, bidCount: 1 });
    expect(await notificationsOf(seller)).toEqual([expect.objectContaining({ type: "new_bid", read: false })]);
  });

  it("must beat the starting price, then the current bid", async () => {
    expect((await bid(neighbor, 10)).body.message).toBe("Bid must be greater than 10");
    expect((await bid(neighbor, 20)).status).toBe(201);
    const third = await insertUser();
    expect((await bid(third, 20)).status).toBe(400);
    expect((await bid(third, 21)).body).toMatchObject({ currentBid: 21, maxBidderId: third, bidCount: 2 });
  });

  it("lists the bid history, newest first, with bidder names", async () => {
    await bid(neighbor, 15);
    const third = await insertUser({ name: "Duda" });
    await bid(third, 18);
    const res = await request(app).get(`/api/listings/${auction}/bids`).set("Cookie", as(seller));
    expect(res.body.map((b: { bidderName: string; amount: number }) => [b.bidderName, b.amount])).toEqual([
      ["Duda", 18],
      ["Ana", 15],
    ]);
  });

  it("doesn't let the seller bid on their own auction", async () => {
    expect((await bid(seller, 50)).status).toBe(403);
  });

  it("hides other buildings' auctions and requires a session", async () => {
    expect((await bid(outsider, 50)).status).toBe(404);
    expect((await request(app).post(`/api/listings/${auction}/bids`).send({ amount: 50 })).status).toBe(401);
    expect((await request(app).get(`/api/listings/${auction}/bids`).set("Cookie", as(outsider))).status).toBe(404);
  });

  it("refuses direct sales, sold auctions and ended auctions", async () => {
    expect((await bid(neighbor, 500, await insertListing(seller))).body.message).toBe(
      "This listing is not an active auction"
    );
    const sold = await insertListing(seller, { type: "auction", status: "sold" });
    expect((await bid(neighbor, 500, sold)).status).toBe(400);
    await pool.query("UPDATE listings SET auction_ends_at = now() - interval '1 minute' WHERE id = $1", [auction]);
    expect((await bid(neighbor, 500)).body.message).toBe("This auction has ended");
  });

  it("rejects non-positive amounts", async () => {
    expect((await bid(neighbor, 0)).status).toBe(400);
    expect((await bid(neighbor, -5)).status).toBe(400);
  });

  it("accepts only one of several identical bids placed at the same time", async () => {
    const bidders = await Promise.all([1, 2, 3, 4, 5].map(() => insertUser()));
    const results = await Promise.all(bidders.map((b) => placeBidTx(auction, b, 20)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);

    const { rows } = await pool.query<{ count: string }>("SELECT count(*) FROM bids WHERE listing_id = $1", [auction]);
    expect(Number(rows[0].count)).toBe(1);
  });

  it("ends concurrent bidding at the highest bid", async () => {
    const bidders = await Promise.all([1, 2, 3, 4, 5].map(() => insertUser()));
    await Promise.all(bidders.map((b, i) => placeBidTx(auction, b, 20 + i)));
    const { rows } = await pool.query<{ current_bid: string; max_bidder_id: string }>(
      "SELECT current_bid, max_bidder_id FROM listings WHERE id = $1",
      [auction]
    );
    expect(Number(rows[0].current_bid)).toBe(24);
    expect(rows[0].max_bidder_id).toBe(bidders[4]);
  });
});

describe("listing Q&A", () => {
  let listing: string;
  beforeEach(async () => {
    listing = await insertListing(seller);
  });
  const ask = (userId: string, body: string, id = listing) =>
    request(app).post(`/api/listings/${id}/messages`).set("Cookie", as(userId)).send({ body });

  it("posts a neighbor's question and tells the seller", async () => {
    const res = await ask(neighbor, "Is it still available?");
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ body: "Is it still available?" });
    expect(await notificationsOf(seller)).toEqual([expect.objectContaining({ type: "message" })]);
  });

  it("doesn't notify the seller about their own answer", async () => {
    expect((await ask(seller, "Yes, it is")).status).toBe(201);
    expect(await notificationsOf(seller)).toEqual([]);
  });

  it("lists the thread in order", async () => {
    await ask(neighbor, "Is it still available?");
    await ask(seller, "Yes, it is");
    const res = await request(app).get(`/api/listings/${listing}/messages`).set("Cookie", as(neighbor));
    expect(res.body.map((m: { body: string }) => m.body)).toEqual(["Is it still available?", "Yes, it is"]);
  });

  it("rejects blank messages and other buildings", async () => {
    expect((await ask(neighbor, "   ")).status).toBe(400);
    expect((await ask(outsider, "Hi")).status).toBe(404);
    expect((await request(app).get(`/api/listings/${listing}/messages`).set("Cookie", as(outsider))).status).toBe(404);
  });

  it("has no Q&A on store products", async () => {
    const admin = await insertUser({ isAdmin: true });
    const product = await insertListing(admin, { storeId: await insertStore(admin) });
    expect((await ask(neighbor, "Hi", product)).status).toBe(400);
    expect((await request(app).get(`/api/listings/${product}/messages`)).body).toEqual([]);
  });
});
