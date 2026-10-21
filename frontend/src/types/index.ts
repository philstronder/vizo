export type ListingType = "direct" | "auction";
export type ListingCondition = "new" | "used-excellent" | "used-good";
export type ListingStatus = "active" | "sold" | "ended" | "draft";
export type ListingCategory = "furniture" | "electronics" | "books" | "plants" | "other";

export interface User {
  id: string;
  name: string;
  email: string;
  unitNumber: string;
  buildingName: string;
  avatarUrl?: string;
  verified: boolean;
  memberSince: string;
}

export interface Bid {
  id: string;
  listingId: string;
  bidderName: string;
  bidderId: string;
  amount: number;
  createdAt: string;
}

export interface Listing {
  id: string;
  title: string;
  description: string;
  category: ListingCategory;
  condition: ListingCondition;
  type: ListingType;
  status: ListingStatus;
  images: string[];
  quantity: number; // units left to sell; always 1 (or 0 once sold) for community listings
  sellerId: string;
  storeId?: string; // set for TV-show store products; unset for community listings
  sellerName: string;
  sellerUnitNumber?: string;
  sellerBuildingName?: string;
  sellerVerified?: boolean;
  sellerMemberSince?: string;
  sellerRating?: number; // average of 1–5 ratings; undefined until the first review
  sellerReviewCount?: number;
  createdAt: string;

  // Direct sale fields
  price?: number;

  // Auction fields
  startingPrice?: number;
  currentBid?: number;
  bidCount?: number;
  auctionEndsAt?: string;
  maxBidderId?: string;
  bids?: Bid[];
}

export interface Store {
  id: string;
  name: string;
  description: string;
  productCount: number;
  createdAt: string;
}

export interface Message {
  id: string;
  listingId: string;
  authorId: string;
  authorName: string;
  role: "buyer" | "seller";
  body: string;
  createdAt: string;
}

export type OrderStatus =
  | "pending_pickup"
  | "ready_for_pickup"
  | "shipped"
  | "completed"
  | "cancelled";

export interface Order {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  price: number;
  fees: number;
  status: OrderStatus;
  pickupLocation?: string;
  pickupTime?: string;
  createdAt: string;
  reviewRating?: number; // the buyer's 1–5 rating of the seller, once given
}

export type NotificationType =
  | "new_bid"
  | "sold"
  | "message"
  | "outbid"
  | "listing_ending"
  | "order_completed";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  href?: string;
}

export interface ListingFilters {
  query?: string;
  categories?: ListingCategory[];
  conditions?: ListingCondition[];
  type?: "all" | ListingType;
  minPrice?: number;
  maxPrice?: number;
}
