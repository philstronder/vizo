import { beforeEach, describe, expect, it } from "vitest";
import {
  acceptMeetup,
  cancelOrder,
  checkoutListingTx,
  confirmDelivery,
  findOrderById,
  proposeMeetup,
  reviewOrder,
} from "../../src/db/orders";
import { getBalance, getWallet } from "../../src/db/credits";
import { pool } from "../../src/db/pool";
import { getListing, giveCredits, insertListing, insertStore, insertUser, ledger, tomorrow } from "./factories";

let buyer: string;
let seller: string;

beforeEach(async () => {
  buyer = await insertUser({ name: "Ana" });
  seller = await insertUser({ name: "Bruno" });
});

async function buy(listingId: string, extra: { useCredits?: boolean; buyerId?: string } = {}) {
  const result = await checkoutListingTx({ listingId, buyerId: extra.buyerId ?? buyer, meetupAt: tomorrow(), useCredits: extra.useCredits });
  if (!result.ok) throw new Error(result.reason);
  return result.orderId;
}

// A community order whose meetup the seller has accepted.
async function agreedOrder(price = 100) {
  const orderId = await buy(await insertListing(seller, { price }));
  const accepted = await acceptMeetup(orderId, seller);
  expect(accepted.ok).toBe(true);
  return orderId;
}

describe("checkoutListingTx", () => {
  it("creates a held community order and marks a single item sold", async () => {
    const listingId = await insertListing(seller, { price: 80 });
    const orderId = await buy(listingId);

    const order = await findOrderById(orderId);
    expect(order).toMatchObject({
      buyer_id: buyer,
      seller_id: seller,
      price: "80.00",
      status: "pending_pickup",
      payment_status: "held",
      meetup_proposed_by: buyer,
      meetup_confirmed: false,
    });
    expect(await getListing(listingId)).toEqual({ status: "sold", quantity: 0 });
  });

  it("requires a meetup time for community sales", async () => {
    const result = await checkoutListingTx({ listingId: await insertListing(seller), buyerId: buyer });
    expect(result).toEqual({ ok: false, reason: "meetup_time_required" });
  });

  it("doesn't let sellers buy their own listing", async () => {
    const result = await checkoutListingTx({ listingId: await insertListing(seller), buyerId: seller, meetupAt: tomorrow() });
    expect(result).toEqual({ ok: false, reason: "cannot_buy_own_listing" });
  });

  it("refuses listings that are sold out or unknown", async () => {
    const soldOut = await checkoutListingTx({
      listingId: await insertListing(seller, { status: "sold", quantity: 0 }),
      buyerId: buyer,
      meetupAt: tomorrow(),
    });
    expect(soldOut).toEqual({ ok: false, reason: "listing_unavailable" });

    const unknown = await checkoutListingTx({
      listingId: "00000000-0000-4000-8000-000000000000",
      buyerId: buyer,
      meetupAt: tomorrow(),
    });
    expect(unknown).toEqual({ ok: false, reason: "listing_not_found" });
  });

  it("only lets the winning bidder check out an auction, at the winning bid", async () => {
    const other = await insertUser();
    const listingId = await insertListing(seller, { type: "auction", currentBid: 55, maxBidderId: buyer });

    const loser = await checkoutListingTx({ listingId, buyerId: other, meetupAt: tomorrow() });
    expect(loser).toEqual({ ok: false, reason: "only_winning_bidder" });

    const order = await findOrderById(await buy(listingId));
    expect(order?.price).toBe("55.00");
  });

  it("sells one unit of a store product at a time, with no escrow or meetup", async () => {
    const admin = await insertUser({ isAdmin: true });
    const storeId = await insertStore(admin);
    const listingId = await insertListing(admin, { storeId, quantity: 2 });

    const first = await checkoutListingTx({ listingId, buyerId: buyer });
    expect(first.ok).toBe(true);
    expect(await getListing(listingId)).toEqual({ status: "active", quantity: 1 });

    const order = await findOrderById((first as { orderId: string }).orderId);
    expect(order).toMatchObject({ payment_status: null, meetup_at: null });

    await checkoutListingTx({ listingId, buyerId: buyer });
    expect(await getListing(listingId)).toEqual({ status: "sold", quantity: 0 });
  });

  it("pays with as many credits as the buyer has", async () => {
    await giveCredits(buyer, 30.5);
    const order = await findOrderById(await buy(await insertListing(seller, { price: 100 }), { useCredits: true }));

    expect(order?.paid_with_credits).toBe("30.50");
    expect(await getBalance(pool, buyer)).toBe(0);
  });

  it("never takes more credits than the price", async () => {
    await giveCredits(buyer, 500);
    const order = await findOrderById(await buy(await insertListing(seller, { price: 100 }), { useCredits: true }));

    expect(order?.paid_with_credits).toBe("100.00");
    expect(await getBalance(pool, buyer)).toBe(400);
  });

  it("leaves credits alone unless asked", async () => {
    await giveCredits(buyer, 50);
    await buy(await insertListing(seller));
    expect(await getBalance(pool, buyer)).toBe(50);
  });

  it("sells the last unit only once when buyers race", async () => {
    const listingId = await insertListing(seller);
    const buyers = await Promise.all([insertUser(), insertUser(), insertUser(), insertUser()]);

    const results = await Promise.all(
      buyers.map((buyerId) => checkoutListingTx({ listingId, buyerId, meetupAt: tomorrow() }))
    );

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await getListing(listingId)).toEqual({ status: "sold", quantity: 0 });
  });

  it("doesn't spend the same credits twice when one buyer checks out concurrently", async () => {
    await giveCredits(buyer, 60);
    const listings = await Promise.all([insertListing(seller, { price: 50 }), insertListing(seller, { price: 50 })]);

    await Promise.all(listings.map((listingId) => buy(listingId, { useCredits: true })));

    const { rows } = await pool.query<{ paid: string }>(
      "SELECT SUM(paid_with_credits) AS paid FROM orders WHERE buyer_id = $1",
      [buyer]
    );
    expect(Number(rows[0].paid)).toBe(60);
    expect(await getBalance(pool, buyer)).toBe(0);
  });
});

describe("meetups", () => {
  it("doesn't let the proposer accept their own time", async () => {
    const orderId = await buy(await insertListing(seller));
    expect(await acceptMeetup(orderId, buyer)).toMatchObject({ ok: false, status: 409 });
  });

  it("lets the other side counter-propose, which resets the agreement", async () => {
    const orderId = await agreedOrder();
    const counter = await proposeMeetup(orderId, buyer, tomorrow());
    expect(counter.ok && counter.order).toMatchObject({ meetup_confirmed: false, meetup_proposed_by: buyer });

    expect((await acceptMeetup(orderId, seller)).ok).toBe(true);
  });

  it("refuses accepting an already agreed meetup", async () => {
    const orderId = await agreedOrder();
    expect(await acceptMeetup(orderId, buyer)).toMatchObject({ ok: false, status: 409 });
  });

  it("only lets the buyer and seller touch the order", async () => {
    const orderId = await buy(await insertListing(seller));
    const stranger = await insertUser();
    expect(await acceptMeetup(orderId, stranger)).toMatchObject({ ok: false, status: 403 });
    expect(await proposeMeetup(orderId, stranger, tomorrow())).toMatchObject({ ok: false, status: 403 });
  });

  it("answers 404 for an unknown order", async () => {
    expect(await acceptMeetup("00000000-0000-4000-8000-000000000000", buyer)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("confirmDelivery", () => {
  it("needs the meetup agreed first", async () => {
    const orderId = await buy(await insertListing(seller));
    expect(await confirmDelivery(orderId, buyer)).toMatchObject({
      ok: false,
      status: 409,
      reason: "meetup_not_agreed",
    });
  });

  it("completes once both sides confirm and releases the payment to the seller as credits", async () => {
    const orderId = await agreedOrder(120);
    await pool.query("UPDATE orders SET fees = 20 WHERE id = $1", [orderId]);
    expect((await getWallet(seller)).held).toBe(100);

    const first = await confirmDelivery(orderId, buyer);
    expect(first).toMatchObject({ ok: true, value: { completed: false, releasedAmount: 0 } });
    expect(first.ok && first.order.status).toBe("pending_pickup");
    expect(await ledger(seller)).toEqual([]);

    const second = await confirmDelivery(orderId, seller);
    expect(second).toMatchObject({ ok: true, value: { completed: true, releasedAmount: 100 } });
    expect(second.ok && second.order).toMatchObject({ status: "completed", payment_status: "released" });

    expect(await ledger(seller)).toEqual([{ type: "sale", amount: 100 }]);
    const wallet = await getWallet(seller);
    expect(wallet).toMatchObject({ balance: 100, held: 0 });
    expect(wallet.transactions[0]).toMatchObject({ type: "sale", amount: 100, orderId, listingTitle: "Bike" });
  });

  it("refuses a second confirmation from the same side", async () => {
    const orderId = await agreedOrder();
    await confirmDelivery(orderId, buyer);
    expect(await confirmDelivery(orderId, buyer)).toMatchObject({ ok: false, status: 409 });
  });

  it("releases the payment exactly once when both sides confirm at the same time", async () => {
    const orderId = await agreedOrder();
    await Promise.all([confirmDelivery(orderId, buyer), confirmDelivery(orderId, seller)]);
    expect(await ledger(seller)).toEqual([{ type: "sale", amount: 100 }]);
    expect((await findOrderById(orderId))?.status).toBe("completed");
  });

  it("completes a store order on the first confirmation without paying credits", async () => {
    const admin = await insertUser({ isAdmin: true });
    const listingId = await insertListing(admin, { storeId: await insertStore(admin) });
    const result = await checkoutListingTx({ listingId, buyerId: buyer });
    const orderId = (result as { orderId: string }).orderId;

    expect(await confirmDelivery(orderId, admin)).toMatchObject({ ok: true, value: { completed: true, releasedAmount: 0 } });
    expect(await ledger(admin)).toEqual([]);
  });
});

describe("cancelOrder", () => {
  it("refunds credits, marks the payment refunded and puts the item back on sale", async () => {
    await giveCredits(buyer, 40);
    const listingId = await insertListing(seller, { price: 100 });
    const orderId = await buy(listingId, { useCredits: true });

    const result = await cancelOrder(orderId, buyer);

    expect(result).toMatchObject({ ok: true, value: { cancelledByBuyer: true } });
    expect(result.ok && result.order).toMatchObject({ status: "cancelled", payment_status: "refunded" });
    expect(await getBalance(pool, buyer)).toBe(40);
    expect(await getListing(listingId)).toEqual({ status: "active", quantity: 1 });
  });

  it("ends a cancelled auction instead of relisting it", async () => {
    const listingId = await insertListing(seller, { type: "auction", currentBid: 20, maxBidderId: buyer });
    await cancelOrder(await buy(listingId), seller);
    expect(await getListing(listingId)).toEqual({ status: "ended", quantity: 1 });
  });

  it("doesn't let the buyer walk away from an agreed meetup, but lets the seller cancel", async () => {
    const orderId = await agreedOrder();
    expect(await cancelOrder(orderId, buyer)).toMatchObject({ ok: false, status: 409 });
    expect(await cancelOrder(orderId, seller)).toMatchObject({ ok: true, value: { cancelledByBuyer: false } });
  });

  it("can't cancel after a handoff confirmation", async () => {
    const orderId = await agreedOrder();
    await confirmDelivery(orderId, buyer);
    expect(await cancelOrder(orderId, seller)).toMatchObject({ ok: false, status: 409 });
  });

  it("can't cancel twice", async () => {
    await giveCredits(buyer, 10);
    const orderId = await buy(await insertListing(seller), { useCredits: true });
    await cancelOrder(orderId, buyer);
    expect(await cancelOrder(orderId, buyer)).toMatchObject({ ok: false, status: 409 });
    expect(await getBalance(pool, buyer)).toBe(10);
  });

  it("refuses store orders", async () => {
    const admin = await insertUser({ isAdmin: true });
    const listingId = await insertListing(admin, { storeId: await insertStore(admin) });
    const { orderId } = (await checkoutListingTx({ listingId, buyerId: buyer })) as { orderId: string };
    expect(await cancelOrder(orderId, buyer)).toMatchObject({ ok: false, status: 409 });
  });
});

describe("reviewOrder", () => {
  it("lets the buyer rate a completed order once", async () => {
    const orderId = await agreedOrder();
    const input = { orderId, userId: buyer, rating: 5 };

    expect(await reviewOrder(input)).toMatchObject({ ok: false, status: 409 });

    await confirmDelivery(orderId, buyer);
    await confirmDelivery(orderId, seller);
    expect(await reviewOrder({ ...input, userId: seller })).toMatchObject({ ok: false, status: 403 });
    expect(await reviewOrder(input)).toEqual({ ok: true });
    expect(await reviewOrder(input)).toMatchObject({ ok: false, status: 409, reason: "already_rated" });
    expect((await findOrderById(orderId))?.review_rating).toBe(5);
  });
});
