import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Notification } from "@/types";
import { formatCurrency } from "./format";

// Builds a notification's title and body in the viewer's language from its
// type + params. Rows without params (created before they existed) keep the
// English text the server stored.
export function notificationText(
  n: Notification,
  t: Dictionary,
  locale: Locale
): { title: string; body: string } {
  const p = n.params;
  if (!p?.listingTitle) return { title: n.title, body: n.body };
  const tn = t.notification;
  const title = p.listingTitle;
  const name = p.actorName ?? "";
  const amount = p.amount != null ? formatCurrency(p.amount, locale) : "";

  switch (n.type) {
    case "sold":
      return {
        title: tn.sold(title),
        body: p.variant === "store" ? tn.soldBodyStore : tn.soldBodyHeld,
      };
    case "new_bid":
      return { title: tn.newBid(title), body: tn.newBidBody(amount) };
    case "message":
      return {
        title: p.variant === "order" ? tn.orderMessage(name, title) : tn.listingMessage(title),
        body: n.body,
      };
    case "delivery_confirmed":
      return { title: tn.deliveryConfirmed(title), body: tn.deliveryConfirmedBody(name) };
    case "order_completed":
      return { title: tn.orderCompleted(title), body: tn.orderCompletedBody(name) };
    case "payment_released":
      return { title: tn.paymentReleased, body: tn.paymentReleasedBody(amount, title) };
    case "meetup_proposed":
      return { title: tn.meetupProposed(title), body: tn.meetupProposedBody(name) };
    case "meetup_confirmed":
      return { title: tn.meetupConfirmed(title), body: tn.meetupConfirmedBody(name) };
    case "order_cancelled":
      return {
        title: tn.orderCancelled(title),
        body: p.variant === "byBuyer" ? tn.orderCancelledByBuyer(name) : tn.orderCancelledBySeller(name),
      };
    default:
      return { title: n.title, body: n.body };
  }
}
