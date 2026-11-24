export type ListingType = "direct" | "auction";
export type ListingCondition = "new" | "used-excellent" | "used-good";
export type ListingStatus = "active" | "sold" | "ended" | "draft";
export type ListingCategory =
  | "furniture"
  | "electronics"
  | "appliances"
  | "vehicles"
  | "clothing"
  | "books"
  | "plants"
  | "services"
  | "real-estate"
  | "other";

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

export interface DeliveryAddress {
  postalCode: string;
  street: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
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
  buyerReviewRating?: number; // the seller's 1–5 rating of the buyer, once given
  // The buyer's reputation: their average rating from sellers across all
  // their orders; buyerRating is undefined until the first review.
  buyerRating?: number;
  buyerReviewCount: number;
  // Store orders are delivered: the buyer's phone and delivery address.
  buyerPhone?: string;
  deliveryAddress?: DeliveryAddress;
  isStoreOrder: boolean;
  // Community sales: the platform holds the payment until both sides confirm
  // the handoff, then releases it to the seller as credits. Unset for store
  // orders and orders placed before escrow existed.
  paymentStatus?: PaymentStatus;
  paidWithCredits: number;
  meetupAt?: string; // ISO; the latest proposed meetup time
  meetupProposedBy?: "buyer" | "seller";
  meetupConfirmed: boolean;
  buyerConfirmedDelivery: boolean;
  sellerConfirmedDelivery: boolean;
  unreadMessages?: number; // chat messages from the other side not yet read
}

// Private chat between an order's buyer and seller.
export interface OrderMessage {
  id: string;
  orderId: string;
  authorId: string;
  authorName: string;
  body: string;
  read: boolean; // whether the other participant has seen it
  createdAt: string;
}

export type PaymentStatus = "held" | "released" | "refunded";

export type CreditTransactionType = "sale" | "purchase" | "refund" | "withdrawal";

export interface CreditTransaction {
  id: string;
  type: CreditTransactionType;
  amount: number; // positive adds credits, negative spends them
  orderId?: string;
  listingTitle?: string;
  pixKey?: string;
  createdAt: string;
}

export interface Wallet {
  balance: number; // credits available to spend or withdraw
  held: number; // sales still waiting for both sides to confirm the handoff
  transactions: CreditTransaction[];
}

export type NotificationType =
  | "new_bid"
  | "sold"
  | "message"
  | "outbid"
  | "listing_ending"
  | "order_completed"
  | "meetup_proposed"
  | "meetup_confirmed"
  | "delivery_confirmed"
  | "payment_released"
  | "order_cancelled"
  | "residency_submitted"
  | "residency_approved"
  | "residency_rejected";

export interface NotificationParams {
  listingTitle?: string;
  actorName?: string;
  amount?: number;
  variant?: string;
  buildingName?: string;
  reason?: string; // why a proof of residency was rejected
}

export interface Notification {
  id: string;
  type: NotificationType;
  // English copy from the server; the UI prefers rendering from type + params.
  title: string;
  body: string;
  params?: NotificationParams;
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

// Error codes the API answers with (backend/src/lib/http-error.ts).
export type ApiErrorCode =
  | "not_authenticated"
  | "not_allowed"
  | "not_found"
  | "invalid_request"
  | "internal_error"
  | "admin_only"
  | "email_taken"
  | "invalid_credentials"
  | "user_not_found"
  | "choose_condominium"
  | "condominium_exists_choose"
  | "condominium_exists"
  | "condominium_not_found"
  | "admin_email_not_found"
  | "cannot_remove_own_admin"
  | "cep_invalid"
  | "cep_unavailable"
  | "cep_not_found"
  | "residency_not_verified"
  | "residency_proof_required"
  | "residency_already_verified"
  | "residency_reviewers_only"
  | "residency_request_not_found"
  | "cannot_review_own_residency"
  | "building_admin_email_not_found"
  | "building_admin_not_found"
  | "listing_not_found"
  | "listing_not_found_or_not_owner"
  | "sign_in_to_see_listings"
  | "tv_account_no_community"
  | "building_required_to_list"
  | "store_not_found"
  | "store_products_admin_only"
  | "store_product_not_restockable"
  | "store_no_questions"
  | "cannot_bid_own_listing"
  | "auction_not_active"
  | "auction_ended"
  | "bid_too_low"
  | "cannot_buy_own_listing"
  | "listing_unavailable"
  | "only_winning_bidder"
  | "meetup_time_required"
  | "order_not_found"
  | "order_participants_only"
  | "order_chat_participants_only"
  | "order_already_status"
  | "order_cancelled"
  | "delivery_already_confirmed"
  | "meetup_not_agreed"
  | "store_order_no_meetup"
  | "no_meetup_proposed"
  | "meetup_already_confirmed"
  | "waiting_other_side_meetup"
  | "store_order_no_cancel"
  | "handoff_already_confirmed"
  | "meetup_agreed_ask_seller"
  | "only_buyer_can_rate"
  | "rate_after_delivery"
  | "already_rated"
  | "only_seller_can_rate_buyer"
  | "rate_buyer_after_delivery"
  | "rate_seller_to_confirm"
  | "rate_buyer_to_confirm"
  | "insufficient_credits"
  | "notification_not_found";
