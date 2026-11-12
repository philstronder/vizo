import { describe, expect, it } from "vitest";
import { HttpError, badRequest, conflict, forbidden, notFound, unauthorized } from "../../src/lib/http-error";
import { signAuthToken, verifyAuthToken } from "../../src/lib/jwt";
import { hashPassword, verifyPassword } from "../../src/lib/password";
import { condominiumSchema, deliveryAddressSchema } from "../../src/lib/schemas";
import { sameBuilding, toDeliveryAddress, toPublicUser } from "../../src/db/users";
import { toApiCreditTransaction, toCents } from "../../src/db/credits";
import { toApiOrder } from "../../src/db/orders";
import { toApiOrderMessage } from "../../src/db/order-messages";
import { BUYER_ID, SELLER_ID, makeOrderRow, makeUserRow } from "./fixtures";

const address = {
  postalCode: "01310-100",
  street: "Av. Paulista",
  number: "1000",
  district: "Bela Vista",
  city: "São Paulo",
  state: "SP",
};

describe("http-error", () => {
  it.each([
    [badRequest("x"), 400],
    [unauthorized(), 401],
    [forbidden(), 403],
    [notFound(), 404],
    [conflict("x"), 409],
  ])("builds an HttpError with the right status", (err, status) => {
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(status);
  });
});

describe("jwt", () => {
  it("round-trips the user id", () => {
    expect(verifyAuthToken(signAuthToken({ userId: "u1" })).userId).toBe("u1");
  });

  it("rejects a tampered token", () => {
    const token = signAuthToken({ userId: "u1" });
    expect(() => verifyAuthToken(token.slice(0, -2) + "xx")).toThrow();
  });
});

describe("password", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("secret123");
    expect(hash).not.toBe("secret123");
    await expect(verifyPassword("secret123", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });
});

describe("schemas", () => {
  it("trims and accepts a full delivery address", () => {
    expect(deliveryAddressSchema.parse({ ...address, street: "  Av. Paulista " }).street).toBe("Av. Paulista");
  });

  it("rejects a blank required field", () => {
    expect(deliveryAddressSchema.safeParse({ ...address, city: "   " }).success).toBe(false);
  });

  it("drops the complement from a condominium address", () => {
    const parsed = condominiumSchema.parse({ name: "Aurora", address: { ...address, complement: "Apto 1" } });
    expect(parsed.address).not.toHaveProperty("complement");
  });
});

describe("sameBuilding", () => {
  it("ignores case and surrounding spaces", () => {
    expect(sameBuilding("  Edifício Aurora ", "edifício aurora")).toBe(true);
  });

  it("is false for different buildings", () => {
    expect(sameBuilding("Aurora", "Boreal")).toBe(false);
  });

  it("never matches an account without a building", () => {
    expect(sameBuilding(null, null)).toBe(false);
    expect(sameBuilding("Aurora", null)).toBe(false);
  });
});

describe("toDeliveryAddress", () => {
  it("is undefined when there is no street", () => {
    expect(toDeliveryAddress(makeUserRow())).toBeUndefined();
  });

  it("maps the address columns", () => {
    const row = makeUserRow({
      address_postal_code: "01310-100",
      address_street: "Av. Paulista",
      address_number: "1000",
      address_complement: null,
      address_district: "Bela Vista",
      address_city: "São Paulo",
      address_state: "SP",
    });
    expect(toDeliveryAddress(row)).toEqual({ ...address, complement: undefined });
  });
});

describe("toPublicUser", () => {
  it("never exposes the password hash and maps nulls to undefined", () => {
    const user = toPublicUser(makeUserRow({ is_admin: true }));
    expect(user).not.toHaveProperty("password_hash");
    expect(user).not.toHaveProperty("passwordHash");
    expect(user).toMatchObject({
      id: BUYER_ID,
      buildingName: "Edifício Aurora",
      buildingBlock: undefined,
      phone: undefined,
      isAdmin: true,
      memberSince: "2026-01-02T03:04:05.000Z",
    });
  });
});

describe("credits helpers", () => {
  it("toCents rounds floating point noise", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(19.999)).toBe(2000);
  });

  it("maps a credit transaction row", () => {
    expect(
      toApiCreditTransaction({
        id: "t1",
        user_id: BUYER_ID,
        order_id: null,
        type: "withdrawal",
        amount: "-12.50",
        pix_key: "ana@pix",
        created_at: new Date("2026-01-02T03:04:05.000Z"),
        listing_title: null,
      })
    ).toEqual({
      id: "t1",
      orderId: undefined,
      type: "withdrawal",
      amount: -12.5,
      listingTitle: undefined,
      pixKey: "ana@pix",
      createdAt: "2026-01-02T03:04:05.000Z",
    });
  });
});

describe("toApiOrder", () => {
  it("converts numeric strings and falls back to the listing id for the image", () => {
    const order = toApiOrder(makeOrderRow({ price: "99.90", fees: "1.50", paid_with_credits: "10.00" }));
    expect(order).toMatchObject({ price: 99.9, fees: 1.5, paidWithCredits: 10, listingImage: order.listingId });
  });

  it("says who proposed the meetup", () => {
    expect(toApiOrder(makeOrderRow({ meetup_proposed_by: BUYER_ID })).meetupProposedBy).toBe("buyer");
    expect(toApiOrder(makeOrderRow({ meetup_proposed_by: SELLER_ID })).meetupProposedBy).toBe("seller");
    expect(toApiOrder(makeOrderRow()).meetupProposedBy).toBeUndefined();
  });

  it("only exposes the buyer's phone and address on store orders", () => {
    const withContact = {
      buyer_phone: "11999999999",
      address_street: "Av. Paulista",
    };
    const community = toApiOrder(makeOrderRow(withContact));
    expect(community.buyerPhone).toBeUndefined();
    expect(community.deliveryAddress).toBeUndefined();
    expect(community.isStoreOrder).toBe(false);

    const store = toApiOrder(makeOrderRow({ ...withContact, store_id: "s1" }));
    expect(store.buyerPhone).toBe("11999999999");
    expect(store.deliveryAddress?.street).toBe("Av. Paulista");
    expect(store.isStoreOrder).toBe(true);
  });

  it("turns confirmation timestamps into booleans", () => {
    const order = toApiOrder(makeOrderRow({ buyer_confirmed_at: new Date() }));
    expect(order.buyerConfirmedDelivery).toBe(true);
    expect(order.sellerConfirmedDelivery).toBe(false);
  });
});

describe("toApiOrderMessage", () => {
  it("turns read_at into a boolean", () => {
    const base = {
      id: "m1",
      order_id: "o1",
      author_id: BUYER_ID,
      author_name: "Ana",
      body: "Hi",
      created_at: new Date("2026-01-02T03:04:05.000Z"),
    };
    expect(toApiOrderMessage({ ...base, read_at: null }).read).toBe(false);
    expect(toApiOrderMessage({ ...base, read_at: new Date() }).read).toBe(true);
  });
});
