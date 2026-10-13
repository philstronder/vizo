export const locales = ["pt-BR", "en-US"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "pt-BR";

// Readable from both the server (to render the right language on first paint)
// and the client (the language switcher writes it), so it is not httpOnly.
export const LOCALE_COOKIE = "vizo_locale";

export const localeLabels: Record<Locale, string> = {
  "pt-BR": "PT-BR",
  "en-US": "EN-US",
};

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
