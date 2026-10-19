// REST client for the VIZO backend (Express + JWT httpOnly cookies).
// Requests are credentialed so the browser sends/receives the httpOnly auth
// cookie automatically — no token handling in JS.

import type {
  Bid,
  Listing,
  ListingCategory,
  ListingCondition,
  ListingType,
  Message,
  Notification,
  Order,
  Store,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  console.log("API_URL: ", API_URL);
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
    throw new ApiError(body?.message ?? res.statusText, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---- auth ----------------------------------------------------------------

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  buildingName: string;
  unitNumber: string;
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

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  unitNumber: string;
  buildingName: string;
}

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

export interface UpdateProfilePayload {
  name: string;
  buildingName: string;
  unitNumber: string;
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
}

export async function createListing(
  payload: CreateListingPayload,
): Promise<Listing> {
  return request("/api/listings", {
    method: "POST",
    body: JSON.stringify(payload),
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

// ---- orders ---------------------------------------------------------------

export interface CheckoutPayload {
  listingId: string;
  pickupLocation?: string;
  pickupTime?: string;
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

export async function reviewOrder(
  id: string,
  payload: { rating: number; comment?: string },
): Promise<Order> {
  return request(`/api/orders/${id}/review`, {
    method: "POST",
    body: JSON.stringify(payload),
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
