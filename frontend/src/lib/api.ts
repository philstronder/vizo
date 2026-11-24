// REST client for the VIZO backend (Express + JWT httpOnly cookies).
// Requests are credentialed so the browser sends/receives the httpOnly auth
// cookie automatically — no token handling in JS.

import type {
  ApiErrorCode,
  Bid,
  DeliveryAddress,
  Listing,
  ListingCategory,
  ListingCondition,
  ListingType,
  Message,
  Notification,
  Order,
  OrderMessage,
  Store,
  Wallet,
} from "@/types";

// Empty by default: requests go to the same origin and Next rewrites /api/*
// to the backend (see BACKEND_URL in next.config.ts).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  status: number;
  // Set by the API so the UI can show the error in the user's language.
  code?: ApiErrorCode;
  params?: Record<string, string | number>;
  constructor(message: string, status: number, code?: ApiErrorCode, params?: Record<string, string | number>) {
    super(message);
    this.status = status;
    this.code = code;
    this.params = params;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? res.statusText, res.status, body?.code, body?.params);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- auth ----------------------------------------------------------------

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  // Unset for TV store viewer accounts, which have a phone and address instead.
  buildingName?: string;
  buildingBlock?: string;
  unitNumber?: string;
  phone?: string;
  deliveryAddress?: DeliveryAddress;
  verified: boolean;
  isAdmin: boolean;
  memberSince: string;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthUser> {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// Building residents join their building's community; TV store viewers
// only shop in stores and give a phone and delivery address instead.
export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
} & (
  | {
      accountType: "resident";
      unitNumber: string;
      buildingBlock?: string;
      // Either a condominium from the list, or one to add to it.
      buildingName?: string;
      newCondominium?: NewCondominium;
    }
  | { accountType: "viewer"; phone: string; deliveryAddress: DeliveryAddress }
);

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logout(): Promise<void> {
  await request("/api/auth/logout", { method: "POST" });
}

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    return await request("/api/auth/me");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

// Omitted fields keep their saved value.
export interface UpdateProfilePayload {
  name: string;
  buildingName?: string;
  unitNumber?: string;
  buildingBlock?: string; // "" clears it
  phone?: string;
  deliveryAddress?: DeliveryAddress;
}

export async function updateProfile(
  payload: UpdateProfilePayload,
): Promise<AuthUser> {
  return request("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// ---- listings ---------------------------------------------------------

export interface ListingQuery {
  status?: string;
  category?: ListingCategory;
  type?: ListingType;
  q?: string;
  sellerId?: string;
  storeId?: string;
}

function toQueryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchListings(
  query: ListingQuery = {},
): Promise<Listing[]> {
  return request(`/api/listings${toQueryString(query)}`);
}

export async function fetchListing(id: string): Promise<Listing> {
  return request(`/api/listings/${id}`);
}

export interface CreateListingPayload {
  title: string;
  description: string;
  category: ListingCategory;
  condition: ListingCondition;
  images: string[];
  type: ListingType;
  price?: number;
  startingPrice?: number;
  auctionDurationDays?: 1 | 3 | 7;
  storeId?: string;
  quantity?: number;
}

export async function createListing(
  payload: CreateListingPayload,
): Promise<Listing> {
  return request("/api/listings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Adds units to a store product (admins only), re-publishing it if it was sold out.
export async function restockListing(
  id: string,
  quantity: number,
): Promise<Listing> {
  return request(`/api/listings/${id}/restock`, {
    method: "POST",
    body: JSON.stringify({ quantity }),
  });
}

export async function deleteListing(id: string): Promise<void> {
  await request(`/api/listings/${id}`, { method: "DELETE" });
}

export async function fetchBids(listingId: string): Promise<Bid[]> {
  return request(`/api/listings/${listingId}/bids`);
}

export async function placeBid(
  listingId: string,
  amount: number,
): Promise<Listing> {
  return request(`/api/listings/${listingId}/bids`, {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export async function fetchMessages(listingId: string): Promise<Message[]> {
  return request(`/api/listings/${listingId}/messages`);
}

export async function postMessage(
  listingId: string,
  body: string,
): Promise<Message> {
  return request(`/api/listings/${listingId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

// ---- stores ---------------------------------------------------------------

export interface StorePayload {
  name: string;
  description: string;
}

export async function fetchStores(): Promise<Store[]> {
  return request("/api/stores");
}

export async function fetchStore(id: string): Promise<Store> {
  return request(`/api/stores/${id}`);
}

export async function createStore(payload: StorePayload): Promise<Store> {
  return request("/api/stores", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateStore(
  id: string,
  payload: StorePayload,
): Promise<Store> {
  return request(`/api/stores/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteStore(id: string): Promise<void> {
  await request(`/api/stores/${id}`, { method: "DELETE" });
}

// ---- admins ---------------------------------------------------------------

export async function fetchAdmins(): Promise<AuthUser[]> {
  return request("/api/admins");
}

export async function addAdmin(email: string): Promise<AuthUser> {
  return request("/api/admins", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function removeAdmin(userId: string): Promise<void> {
  await request(`/api/admins/${userId}`, { method: "DELETE" });
}

// ---- condominiums ---------------------------------------------------------

export interface Condominium {
  id: string;
  name: string;
  // Unset for condominiums added before addresses were required.
  address?: DeliveryAddress;
}

export async function fetchCondominiums(): Promise<Condominium[]> {
  return request("/api/condominiums");
}

export interface NewCondominium {
  name: string;
  address: DeliveryAddress;
}

export async function addCondominium(name: string, address: DeliveryAddress): Promise<Condominium> {
  return request("/api/condominiums", {
    method: "POST",
    body: JSON.stringify({ name, address }),
  });
}

export async function removeCondominium(id: string): Promise<void> {
  await request(`/api/condominiums/${id}`, { method: "DELETE" });
}

// ---- cep ------------------------------------------------------------------

export type CepAddress = Pick<DeliveryAddress, "postalCode" | "street" | "district" | "city" | "state">;

export async function lookupCep(cep: string): Promise<CepAddress> {
  return request(`/api/cep/${cep}`);
}

// ---- orders ---------------------------------------------------------------

export interface CheckoutPayload {
  listingId: string;
  pickupLocation?: string;
  meetupAt?: string; // ISO; required for community listings
  useCredits?: boolean; // pay as much as the buyer's credits cover
}

export async function checkout(payload: CheckoutPayload): Promise<Order> {
  return request("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMyOrders(): Promise<Order[]> {
  return request("/api/orders/mine");
}

export async function completeOrder(id: string): Promise<Order> {
  return request(`/api/orders/${id}/complete`, { method: "PATCH" });
}

// Suggests a (new) meetup time; the other side has to accept it.
export async function proposeMeetup(id: string, meetupAt: string): Promise<Order> {
  return request(`/api/orders/${id}/meetup`, {
    method: "PATCH",
    body: JSON.stringify({ meetupAt }),
  });
}

export async function acceptMeetup(id: string): Promise<Order> {
  return request(`/api/orders/${id}/meetup/accept`, { method: "POST" });
}

export async function cancelOrder(id: string): Promise<Order> {
  return request(`/api/orders/${id}/cancel`, { method: "POST" });
}

// Also marks the other side's messages as read.
export async function fetchOrderMessages(id: string): Promise<OrderMessage[]> {
  return request(`/api/orders/${id}/messages`);
}

export async function sendOrderMessage(id: string, body: string): Promise<OrderMessage> {
  return request(`/api/orders/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export async function reviewOrder(
  id: string,
  payload: { rating: number; comment?: string },
): Promise<Order> {
  return request(`/api/orders/${id}/review`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---- wallet ---------------------------------------------------------------

export async function fetchWallet(): Promise<Wallet> {
  return request("/api/wallet");
}

export async function withdrawCredits(amount: number, pixKey: string): Promise<Wallet> {
  return request("/api/wallet/withdraw", {
    method: "POST",
    body: JSON.stringify({ amount, pixKey }),
  });
}

// ---- notifications ----------------------------------------------------

export async function fetchNotifications(): Promise<Notification[]> {
  return request("/api/notifications");
}

export async function markNotificationRead(id: string): Promise<void> {
  await request(`/api/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await request("/api/notifications/read-all", { method: "PATCH" });
}
