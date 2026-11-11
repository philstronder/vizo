import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider } from "@/i18n/I18nProvider";
import type { Locale } from "@/i18n/config";

// Renders ui inside the providers every page has. Defaults to English so
// tests can query by the en-US strings.
export function renderWithProviders(ui: ReactElement, { locale = "en-US", ...options }: RenderOptions & { locale?: Locale } = {}) {
  return render(ui, {
    wrapper: ({ children }) => <I18nProvider initialLocale={locale}>{children}</I18nProvider>,
    ...options,
  });
}
