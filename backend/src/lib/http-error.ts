// Every error the API can answer with. The response carries the code (and any
// params) so the frontend can show it in the user's language; the English
// text here is the `message` fallback. Placeholders like {floor} are filled
// from params. Keep the codes in sync with ApiErrorCode in the frontend.
export const errorMessages = {
  // generic
  not_authenticated: "Not authenticated",
  not_allowed: "Not allowed",
  not_found: "Not found",
  invalid_request: "Invalid request",
  internal_error: "Internal server error",
  admin_only: "Only admins can do this",

  // accounts and admins
  email_taken: "An account with this email already exists",
  invalid_credentials: "Invalid email or password",
  user_not_found: "User not found",
  choose_condominium: "Choose a condominium from the list",
  condominium_exists_choose: "This condominium is already on the list; choose it there",
  condominium_exists: "This condominium is already on the list",
  condominium_not_found: "Condominium not found",
  admin_email_not_found: "No account with this email. Ask them to sign up first.",
  cannot_remove_own_admin: "You can't remove your own admin access",
  cep_invalid: "CEP must have 8 digits",
  cep_unavailable: "CEP lookup is unavailable",
  cep_not_found: "CEP not found",

  // listings, bids and stores
  listing_not_found: "Listing not found",
  listing_not_found_or_not_owner: "Listing not found, or you don't own it",
  sign_in_to_see_listings: "Sign in to see your community's listings",
  tv_account_no_community: "TV store accounts don't have a building community",
  building_required_to_list: "Add a building to your profile to list items in a community",
  store_not_found: "Store not found",
  store_products_admin_only: "Only admins can add products to a store",
  store_product_not_restockable: "Store product not found, or it can't be restocked",
  store_no_questions: "Store products don't take questions",
  cannot_bid_own_listing: "You cannot bid on your own listing",
  auction_not_active: "This listing is not an active auction",
  auction_ended: "This auction has ended",
  bid_too_low: "Bid must be greater than {floor}",

  // checkout and orders
  cannot_buy_own_listing: "You cannot buy your own listing",
  listing_unavailable: "This listing is no longer available",
  only_winning_bidder: "Only the winning bidder can check out this auction",
  meetup_time_required: "Suggest a date and time to meet the seller",
  order_not_found: "Order not found",
  order_participants_only: "Only the buyer or seller can update this order",
  order_chat_participants_only: "Only the buyer or seller can see this conversation",
  order_already_status: "This order is already {status}",
  order_cancelled: "This order was cancelled",
  delivery_already_confirmed: "You already confirmed this delivery",
  meetup_not_agreed: "Agree on the meetup time before confirming the handoff",
  store_order_no_meetup: "Store orders are delivered, not picked up",
  no_meetup_proposed: "No meetup time has been proposed",
  meetup_already_confirmed: "The meetup is already confirmed",
  waiting_other_side_meetup: "Waiting for the other side to accept your proposed time",
  store_order_no_cancel: "Store orders can't be cancelled here",
  handoff_already_confirmed: "The handoff was already confirmed, so this order can't be cancelled",
  meetup_agreed_ask_seller: "The meetup is already agreed. Ask the seller to cancel",
  only_buyer_can_rate: "Only the buyer can rate this seller",
  rate_after_delivery: "You can rate the seller once the order is delivered",
  already_rated: "You already rated this order",

  // wallet and notifications
  insufficient_credits: "You don't have enough credits for this withdrawal",
  notification_not_found: "Notification not found",
} as const;

export type ErrorCode = keyof typeof errorMessages;
export type ErrorParams = Record<string, string | number>;

export function errorMessage(code: ErrorCode, params?: ErrorParams): string {
  return errorMessages[code].replace(/\{(\w+)\}/g, (match, key: string) =>
    params && key in params ? String(params[key]) : match
  );
}

export class HttpError extends Error {
  status: number;
  code: ErrorCode;
  params?: ErrorParams;
  constructor(status: number, code: ErrorCode, params?: ErrorParams) {
    super(errorMessage(code, params));
    this.status = status;
    this.code = code;
    this.params = params;
  }
}

export const badRequest = (code: ErrorCode, params?: ErrorParams) => new HttpError(400, code, params);
export const unauthorized = (code: ErrorCode = "not_authenticated") => new HttpError(401, code);
export const forbidden = (code: ErrorCode = "not_allowed") => new HttpError(403, code);
export const notFound = (code: ErrorCode = "not_found") => new HttpError(404, code);
export const conflict = (code: ErrorCode, params?: ErrorParams) => new HttpError(409, code, params);
