import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { OrderStatus } from "@/types";
import { ApiError } from "./api";
import { formatCurrency } from "./format";

// The text to show for a failed request, in the user's language. Known API
// error codes are translated; an API error without one keeps the server's
// message, and anything else (e.g. the network being down) shows `fallback`.
export function errorMessage(err: unknown, t: Dictionary, locale: Locale, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  const entry = err.code ? t.errors[err.code] : undefined;
  if (entry === undefined) return err.message || fallback;
  if (typeof entry === "string") return entry;

  const params = err.params ?? {};
  if (err.code === "bid_too_low") return entry(formatCurrency(Number(params.floor), locale));
  if (err.code === "order_already_status") {
    const status = String(params.status);
    return entry(t.orders.status[status as OrderStatus] ?? status);
  }
  return entry("");
}
