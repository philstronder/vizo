import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

// Prices are stored as plain numbers; the currency shown follows the selected
// locale. Amounts are not converted between currencies.
const currencyByLocale: Record<Locale, string> = {
  "pt-BR": "BRL",
  "en-US": "USD",
};

export function currencySymbol(locale: Locale): string {
  return (
    new Intl.NumberFormat(locale, { style: "currency", currency: currencyByLocale[locale] })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currencyByLocale[locale]
  );
}

export function formatCurrency(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyByLocale[locale],
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatRelativeTime(iso: string, locale: Locale): string {
  const t = getDictionary(locale).time;
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return t.justNow;
  if (diffMin < 60) return t.minutesAgo(diffMin);
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return t.hoursAgo(diffHr);
  const diffDay = Math.round(diffHr / 24);
  return t.daysAgo(diffDay);
}

export function formatCountdown(iso: string, locale: Locale): string {
  const t = getDictionary(locale).time;
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return t.ended;
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return t.daysHoursLeft(days, hours);
  if (hours > 0) return t.hoursMinutesLeft(hours, minutes);
  return t.minutesLeft(minutes);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
