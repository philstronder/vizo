import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { getBalance, withdrawCredits } from "../../src/db/credits";
import { checkoutListingTx } from "../../src/db/orders";
import { createOrderMessage, listOrderMessages } from "../../src/db/order-messages";
import { listOrdersForUser } from "../../src/db/orders";
import { pool } from "../../src/db/pool";
import { AUTH_COOKIE_NAME, signAuthToken } from "../../src/lib/jwt";
import { giveCredits, insertListing, insertUser, ledger, tomorrow } from "./factories";

let buyer: string;
let seller: string;

beforeEach(async () => {
  buyer = await insertUser({ name: "Ana" });
  seller = await insertUser({ name: "Bruno" });
});

describe("withdrawCredits", () => {
  it("records the withdrawal with its pix key", async () => {
    await giveCredits(seller, 50);
    expect(await withdrawCredits({ userId: seller, amount: 20.25, pixKey: "bruno@pix" })).toEqual({ ok: true });
    expect(await getBalance(pool, seller)).toBe(29.75);
    expect((await ledger(seller)).at(-1)).toEqual({ type: "withdrawal", amount: -20.25 });
  });

  it("refuses to overdraw", async () => {
    await giveCredits(seller, 10);
    expect(await withdrawCredits({ userId: seller, amount: 10.01, pixKey: "k" })).toMatchObject({ ok: false });
    expect(await getBalance(pool, seller)).toBe(10);
  });

  it("lets the whole balance out, even with float noise", async () => {
    await giveCredits(seller, 0.3);
    expect(await withdrawCredits({ userId: seller, amount: 0.1 + 0.2, pixKey: "k" })).toEqual({ ok: true });
  });

  it("doesn't overdraw under concurrent withdrawals", async () => {
    await giveCredits(seller, 100);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => withdrawCredits({ userId: seller, amount: 40, pixKey: "k" }))
    );
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(await getBalance(pool, seller)).toBe(20);
  });
});

describe("order chat", () => {
  async function newOrder() {
    const result = await checkoutListingTx({ listingId: await insertListing(seller), buyerId: buyer, meetupAt: tomorrow() });
    return (result as { orderId: string }).orderId;
  }

  it("reports unread batches and marks them read when the other side opens the chat", async () => {
    const orderId = await newOrder();

    expect((await createOrderMessage(orderId, buyer, "Hi")).hadUnread).toBe(false);
    expect((await createOrderMessage(orderId, buyer, "Still there?")).hadUnread).toBe(true);
    expect((await listOrdersForUser(seller))[0].unread_messages).toBe(2);
    // The author's own messages never count as unread for them.
    expect((await listOrdersForUser(buyer))[0].unread_messages).toBe(0);

    // Reading your own chat doesn't mark your messages read.
    await listOrderMessages(orderId, buyer);
    expect((await listOrdersForUser(seller))[0].unread_messages).toBe(2);

    const messages = await listOrderMessages(orderId, seller);
    expect(messages.map((m) => [m.body, m.author_name, !!m.read_at])).toEqual([
      ["Hi", "Ana", true],
      ["Still there?", "Ana", true],
    ]);
    expect((await listOrdersForUser(seller))[0].unread_messages).toBe(0);

    // A new batch starts once the last one was read.
    expect((await createOrderMessage(orderId, buyer, "See you!")).hadUnread).toBe(false);
  });
});

describe("community sale over HTTP", () => {
  const as = (userId: string) => `${AUTH_COOKIE_NAME}=${signAuthToken({ userId })}`;

  it("goes from checkout to paid seller", async () => {
    const listingId = await insertListing(seller, { price: 75 });
    await giveCredits(buyer, 25);

    const checkout = await request(app)
      .post("/api/orders")
      .set("Cookie", as(buyer))
      .send({ listingId, meetupAt: tomorrow().toISOString(), useCredits: true });
    expect(checkout.status).toBe(201);
    expect(checkout.body).toMatchObject({ paymentStatus: "held", paidWithCredits: 25, meetupProposedBy: "buyer" });
    const orderId = checkout.body.id;

    expect((await request(app).post(`/api/orders/${orderId}/meetup/accept`).set("Cookie", as(seller))).status).toBe(200);
    expect((await request(app).patch(`/api/orders/${orderId}/complete`).set("Cookie", as(buyer)).send({ rating: 5 })).status).toBe(200);
    const done = await request(app).patch(`/api/orders/${orderId}/complete`).set("Cookie", as(seller)).send({ rating: 4 });
    expect(done.body).toMatchObject({ status: "completed", paymentStatus: "released" });

    const wallet = await request(app).get("/api/wallet").set("Cookie", as(seller));
    expect(wallet.body).toMatchObject({ balance: 75, held: 0 });

    const { rows } = await pool.query<{ type: string }>(
      "SELECT type FROM notifications WHERE user_id = $1 ORDER BY created_at",
      [seller]
    );
    expect(rows.map((r) => r.type)).toEqual(["sold", "delivery_confirmed", "payment_released"]);
  });
});
