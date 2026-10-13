"use client";

import { formatCountdown } from "@/lib/format";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { Locale } from "@/i18n/config";

function computeState(endsAt: string, locale: Locale) {
  return {
    label: formatCountdown(endsAt, locale),
    ending: new Date(endsAt).getTime() - Date.now() < 1000 * 60 * 60 * 3,
  };
}

export function Countdown({ endsAt, className }: { endsAt: string; className?: string }) {
  const { locale } = useI18n();
  const [state, setState] = useState(() => computeState(endsAt, locale));

  // Relabel immediately when the language changes instead of waiting for the next tick.
  const [prevLocale, setPrevLocale] = useState(locale);
  if (locale !== prevLocale) {
    setPrevLocale(locale);
    setState(computeState(endsAt, locale));
  }

  useEffect(() => {
    const id = setInterval(() => setState(computeState(endsAt, locale)), 30_000);
    return () => clearInterval(id);
  }, [endsAt, locale]);

  return (
    <span className={`${className ?? ""} ${state.ending ? "text-danger" : "text-ink-600"}`}>
      {state.label}
    </span>
  );
}
