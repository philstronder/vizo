import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app";
import {
  acceptMeetup,
  cancelOrder,
  checkoutListingTx,
  confirmDelivery,
  findOrderById,
  proposeMeetup,
  reviewOrder,
} from "../../src/db/orders";
import { findListingById, type ListingRow } from "../../src/db/listings";
import { createNotification } from "../../src/db/notifications";
import { createOrderMessage, listOrderMessages } from "../../src/db/order-messages";
import { findViewableListing } from "../../src/lib/listing-access";
import { notFound } from "../../src/lib/http-error";
import { BUYER_ID, LISTING_ID, ORDER_ID, SELLER_ID, STRANGER_ID, authCookie, makeOrderRow } from "./fixtures";

vi.mock("../../src/db/orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/db/orders")>()),
  listOrdersForUser: vi.fn(),
  checkoutListingTx: vi.fn(),
  findOrderById: vi.fn(),
  confirmDelivery: vi.fn(),
  proposeMeetup: vi.fn(),
  acceptMeetup: vi.fn(),
  cancelOrder: vi.fn(),
  reviewOrder: vi.fn(),
}));
vi.mock("../../src/db/listings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/db/listings")>()),
  findListingById: vi.fn(),
}));
vi.mock("../../src/db/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/db/notifications")>()),
  createNotification: vi.fn(),
}));
vi.mock("../../src/db/order-messages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/db/order-messages")>()),
  createOrderMessage: vi.fn(),
  listOrderMessages: vi.fn(),
}));
vi.mock("../../src/lib/listing-access", () => ({ findViewableListing: vi.fn() }));

const order = makeOrderRow();
const future = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const notifications = () => vi.mocked(createNotification).mock.calls.map(([n]) => n);

const messageRow = {
  id: "m1",
  order_id: ORDER_ID,
  author_id: BUYER_ID,
  author_name: "Ana",
  body: "See you at 6?",
  read_at: null,
  created_at: new Date(),
};

beforeEach(() => {
  vi.mocked(findOrderById).mockResolvedValue(order);
  vi.mocked(findViewableListing).mockResolvedValue({} as ListingRow);
  vi.mocked(findListingById).mockResolvedValue({ seller_id: SELLER_ID, title: "Bike", store_id: null } as ListingRow);
});

describe("auth", () => {
  it.each([
    ["get", "/api/orders/mine"],
    ["post", "/api/orders"],
    ["patch", `/api/orders/${ORDER_ID}/complete`],
    ["post", `/api/orders/${ORDER_ID}/cancel`],
    ["get", `/api/orders/${ORDER_ID}/messages`],
  ] as const)("%s %s requires a session", async (method, path) => {
    expect((await request(app)[method](path)).status).toBe(401);
  });
});

describe("POST /api/orders (checkout)", () => {
  const checkout = (body: object) => request(app).post("/api/orders").set("Cookie", authCookie(BUYER_ID)).send(body);

  it("creates the order and tells the seller the payment is held", async () => {
    vi.mocked(checkoutListingTx).mockResolvedValue({ ok: true, orderId: ORDER_ID });
    const meetupAt = future();

    const res = await checkout({ listingId: LISTING_ID, meetupAt, useCredits: true });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(ORDER_ID);
    expect(vi.mocked(checkoutListingTx).mock.calls[0][0]).toMatchObject({
      listingId: LISTING_ID,
      buyerId: BUYER_ID,
      useCredits: true,
      meetupAt: new Date(meetupAt),
    });
    expect(notifications()).toEqual([
      expect.objectContaining({ userId: SELLER_ID, type: "sold", body: expect.stringMatching(/held by MyVizo/) }),
    ]);
  });

  it("checks the buyer can see the listing before buying", async () => {
    vi.mocked(findViewableListing).mockRejectedValue(notFound("listing_not_found"));
    const res = await checkout({ listingId: LISTING_ID, meetupAt: future() });
    expect(res.status).toBe(404);
    expect(checkoutListingTx).not.toHaveBeenCalled();
  });

  it("rejects a meetup in the past", async () => {
    const res = await checkout({ listingId: LISTING_ID, meetupAt: new Date(Date.now() - 3_600_000).toISOString() });
    expect(res.status).toBe(400);
    expect(checkoutListingTx).not.toHaveBeenCalled();
  });

  it("rejects a meetup without a time zone offset", async () => {
    const res = await checkout({ listingId: LISTING_ID, meetupAt: "2099-01-01T10:00" });
    expect(res.status).toBe(400);
  });

  it("answers 400 with the reason when the listing can't be bought", async () => {
    vi.mocked(checkoutListingTx).mockResolvedValue({ ok: false, reason: "cannot_buy_own_listing" });
    const res = await checkout({ listingId: LISTING_ID, meetupAt: future() });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: "cannot_buy_own_listing", message: "You cannot buy your own listing" });
    expect(createNotification).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/orders/:id/complete", () => {
  const complete = (userId: string) =>
    request(app).patch(`/api/orders/${ORDER_ID}/complete`).set("Cookie", authCookie(userId));

  it("asks the other side to confirm after the first confirmation", async () => {
    vi.mocked(confirmDelivery).mockResolvedValue({ ok: true, order, value: { completed: false, releasedAmount: 0 } });
    const res = await complete(BUYER_ID);
    expect(res.status).toBe(200);
    expect(notifications()).toEqual([expect.objectContaining({ userId: SELLER_ID, type: "delivery_confirmed" })]);
  });

  it("tells the seller their payment was released once both confirmed", async () => {
    vi.mocked(confirmDelivery).mockResolvedValue({ ok: true, order, value: { completed: true, releasedAmount: 100 } });
    await complete(BUYER_ID);
    expect(notifications()).toEqual([
      expect.objectContaining({ userId: SELLER_ID, type: "order_completed" }),
      expect.objectContaining({ userId: SELLER_ID, type: "payment_released", body: expect.stringContaining("100.00") }),
    ]);
  });

  it("notifies the buyer when the seller confirms", async () => {
    vi.mocked(confirmDelivery).mockResolvedValue({ ok: true, order, value: { completed: false, releasedAmount: 0 } });
    await complete(SELLER_ID);
    expect(notifications()[0]).toMatchObject({ userId: BUYER_ID, body: expect.stringContaining("Bruno") });
  });

  it("passes on the status of a refused confirmation", async () => {
    vi.mocked(confirmDelivery).mockResolvedValue({ ok: false, status: 409, reason: "delivery_already_confirmed" });
    const res = await complete(BUYER_ID);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: "delivery_already_confirmed", message: "You already confirmed this delivery" });
    expect(createNotification).not.toHaveBeenCalled();
  });
});

describe("meetups", () => {
  it("proposes a new time and notifies the other side", async () => {
    vi.mocked(proposeMeetup).mockResolvedValue({ ok: true, order, value: undefined });
    const meetupAt = future();
    const res = await request(app)
      .patch(`/api/orders/${ORDER_ID}/meetup`)
      .set("Cookie", authCookie(SELLER_ID))
      .send({ meetupAt });
    expect(res.status).toBe(200);
    expect(proposeMeetup).toHaveBeenCalledWith(ORDER_ID, SELLER_ID, new Date(meetupAt));
    expect(notifications()).toEqual([expect.objectContaining({ userId: BUYER_ID, type: "meetup_proposed" })]);
  });

  it("requires a meetup time", async () => {
    const res = await request(app).patch(`/api/orders/${ORDER_ID}/meetup`).set("Cookie", authCookie(SELLER_ID)).send({});
    expect(res.status).toBe(400);
  });

  it("accepts the proposed time", async () => {
    vi.mocked(acceptMeetup).mockResolvedValue({ ok: true, order, value: undefined });
    const res = await request(app).post(`/api/orders/${ORDER_ID}/meetup/accept`).set("Cookie", authCookie(SELLER_ID));
    expect(res.status).toBe(200);
    expect(notifications()).toEqual([expect.objectContaining({ userId: BUYER_ID, type: "meetup_confirmed" })]);
  });
});

describe("POST /api/orders/:id/cancel", () => {
  it.each([
    [BUYER_ID, SELLER_ID, /back on sale/],
    [SELLER_ID, BUYER_ID, /refunded/],
  ])("tells the other side what happens next", async (actor, other, body) => {
    vi.mocked(cancelOrder).mockResolvedValue({
      ok: true,
      order,
      value: { cancelledByBuyer: actor === BUYER_ID },
    });
    const res = await request(app).post(`/api/orders/${ORDER_ID}/cancel`).set("Cookie", authCookie(actor));
    expect(res.status).toBe(200);
    expect(notifications()).toEqual([expect.objectContaining({ userId: other, type: "order_cancelled", body: expect.stringMatching(body) })]);
  });
});

describe("POST /api/orders/:id/review", () => {
  const review = (body: object) =>
    request(app).post(`/api/orders/${ORDER_ID}/review`).set("Cookie", authCookie(BUYER_ID)).send(body);

  it.each([0, 6, 3.5])("rejects a rating of %s", async (rating) => {
    expect((await review({ rating })).status).toBe(400);
    expect(reviewOrder).not.toHaveBeenCalled();
  });

  it("drops an empty comment", async () => {
    vi.mocked(reviewOrder).mockResolvedValue({ ok: true });
    const res = await review({ rating: 5, comment: "   " });
    expect(res.status).toBe(201);
    expect(vi.mocked(reviewOrder).mock.calls[0][0].comment).toBeUndefined();
  });
});

describe("order chat", () => {
  it("is hidden from anyone but the buyer and the seller", async () => {
    const read = await request(app).get(`/api/orders/${ORDER_ID}/messages`).set("Cookie", authCookie(STRANGER_ID));
    const write = await request(app)
      .post(`/api/orders/${ORDER_ID}/messages`)
      .set("Cookie", authCookie(STRANGER_ID))
      .send({ body: "hi" });
    expect(read.status).toBe(403);
    expect(write.status).toBe(403);
    expect(listOrderMessages).not.toHaveBeenCalled();
    expect(createOrderMessage).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown order", async () => {
    vi.mocked(findOrderById).mockResolvedValue(null);
    const res = await request(app).get(`/api/orders/${ORDER_ID}/messages`).set("Cookie", authCookie(BUYER_ID));
    expect(res.status).toBe(404);
  });

  it("lists messages, marking them read for the reader", async () => {
    vi.mocked(listOrderMessages).mockResolvedValue([messageRow]);
    const res = await request(app).get(`/api/orders/${ORDER_ID}/messages`).set("Cookie", authCookie(SELLER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ id: "m1", body: "See you at 6?", read: false })]);
    expect(listOrderMessages).toHaveBeenCalledWith(ORDER_ID, SELLER_ID);
  });

  const send = (body: string) =>
    request(app).post(`/api/orders/${ORDER_ID}/messages`).set("Cookie", authCookie(BUYER_ID)).send({ body });

  it("notifies the other side about the first unread message only", async () => {
    vi.mocked(createOrderMessage).mockResolvedValueOnce({ message: messageRow, hadUnread: false });
    vi.mocked(createOrderMessage).mockResolvedValueOnce({ message: messageRow, hadUnread: true });

    expect((await send("See you at 6?")).status).toBe(201);
    expect((await send("Hello?")).status).toBe(201);

    expect(notifications()).toEqual([
      expect.objectContaining({ userId: SELLER_ID, type: "message", href: `/orders?chat=${ORDER_ID}` }),
    ]);
  });

  it("rejects blank and overlong messages", async () => {
    expect((await send("   ")).status).toBe(400);
    expect((await send("x".repeat(2001))).status).toBe(400);
  });

  it("can't be written to once the order is cancelled", async () => {
    vi.mocked(findOrderById).mockResolvedValue(makeOrderRow({ status: "cancelled" }));
    expect((await send("hi")).status).toBe(409);
    expect(createOrderMessage).not.toHaveBeenCalled();
  });
});

describe("error handling", () => {
  it("answers 404 for unknown routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Route not found: GET /api/nope");
  });

  it("maps a malformed UUID (Postgres 22P02) to 404", async () => {
    vi.mocked(findOrderById).mockRejectedValue(Object.assign(new Error("invalid input syntax"), { code: "22P02" }));
    const res = await request(app).get("/api/orders/not-a-uuid/messages").set("Cookie", authCookie(BUYER_ID));
    expect(res.status).toBe(404);
  });

  it("hides unexpected errors behind a 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(findOrderById).mockRejectedValue(new Error("connection lost to db-host-1"));
    const res = await request(app).get(`/api/orders/${ORDER_ID}/messages`).set("Cookie", authCookie(BUYER_ID));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ code: "internal_error", message: "Internal server error" });
  });
});
