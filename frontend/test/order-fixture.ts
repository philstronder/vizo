import type { Order } from "@/types";

// A community order between Ana (buyer "b") and Bruno (seller "s"), with the
// meetup not yet agreed. Override what a test needs.
export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    listingId: "l1",
    listingTitle: "Bike",
    listingImage: "l1",
    buyerId: "b",
    buyerName: "Ana",
    sellerId: "s",
    sellerName: "Bruno",
    price: 100,
    fees: 0,
    status: "pending_pickup",
    createdAt: "2026-11-01T12:00:00.000Z",
    isStoreOrder: false,
    paymentStatus: "held",
    paidWithCredits: 0,
    meetupAt: "2026-11-20T18:30:00.000Z",
    meetupProposedBy: "buyer",
    meetupConfirmed: false,
    buyerConfirmedDelivery: false,
    sellerConfirmedDelivery: false,
    buyerReviewCount: 0,
    ...overrides,
  };
}

// The same order once both sides confirmed the handoff.
export function makeCompletedOrder(overrides: Partial<Order> = {}): Order {
  return makeOrder({
    status: "completed",
    paymentStatus: "released",
    meetupConfirmed: true,
    buyerConfirmedDelivery: true,
    sellerConfirmedDelivery: true,
    ...overrides,
  });
}
