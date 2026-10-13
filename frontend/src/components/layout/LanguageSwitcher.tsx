"use client";

import { Globe } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { isLocale, localeLabels, locales } from "@/i18n/config";
import { cn } from "@/lib/cn";

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className={cn("relative flex items-center text-ink-600", className)}>
      <Globe className="pointer-events-none absolute left-2" size={14} />
      <span className="sr-only">{t.common.language}</span>
      <select
        value={locale}
        onChange={(e) => isLocale(e.target.value) && setLocale(e.target.value)}
        className="cursor-pointer appearance-none rounded-full border border-line-strong bg-paper py-1.5 pl-7 pr-2.5 text-xs font-semibold outline-none hover:bg-cream-100 focus:ring-2 focus:ring-amber/60"
      >
        {locales.map((l) => (
          <option key={l} value={l}>
            {localeLabels[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
