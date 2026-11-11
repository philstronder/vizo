import type { UserRow } from "../../src/db/users";
import type { OrderRow } from "../../src/db/orders";
import { AUTH_COOKIE_NAME, signAuthToken } from "../../src/lib/jwt";

export const BUYER_ID = "00000000-0000-4000-8000-000000000001";
export const SELLER_ID = "00000000-0000-4000-8000-000000000002";
export const STRANGER_ID = "00000000-0000-4000-8000-000000000003";
export const ORDER_ID = "00000000-0000-4000-8000-0000000000aa";
export const LISTING_ID = "00000000-0000-4000-8000-0000000000bb";

// A Cookie header that signs the request in as userId.
export function authCookie(userId: string): string {
  return `${AUTH_COOKIE_NAME}=${signAuthToken({ userId })}`;
}

export function makeUserRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: BUYER_ID,
    name: "Ana Souza",
    email: "ana@example.com",
    password_hash: "hash",
    building_name: "Edifício Aurora",
    building_block: null,
    unit_number: "42",
    phone: null,
    address_postal_code: null,
    address_street: null,
    address_number: null,
    address_complement: null,
    address_district: null,
    address_city: null,
    address_state: null,
    verified: true,
    is_admin: false,
    created_at: new Date("2026-01-02T03:04:05.000Z"),
    ...overrides,
  };
}

export function makeOrderRow(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: ORDER_ID,
    listing_id: LISTING_ID,
    listing_title: "Bike",
    listing_image: null,
    buyer_id: BUYER_ID,
    buyer_name: "Ana",
    seller_id: SELLER_ID,
    seller_name: "Bruno",
    price: "100.00",
    fees: "0.00",
    status: "pending_pickup",
    pickup_location: null,
    pickup_time: null,
    created_at: new Date("2026-01-02T03:04:05.000Z"),
    review_rating: null,
    store_id: null,
    buyer_phone: null,
    payment_status: "held",
    paid_with_credits: "0.00",
    meetup_at: null,
    meetup_proposed_by: null,
    meetup_confirmed: false,
    buyer_confirmed_at: null,
    seller_confirmed_at: null,
    address_postal_code: null,
    address_street: null,
    address_number: null,
    address_complement: null,
    address_district: null,
    address_city: null,
    address_state: null,
    ...overrides,
  };
}
