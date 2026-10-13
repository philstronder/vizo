"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/i18n/I18nProvider";

// Read-only stars for a 0–5 value; fractional values partially fill a star.
export function StarRating({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={t.stars.outOfFive(value.toFixed(1))}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-line-strong" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} className="fill-amber text-amber-500" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

// Clickable 1–5 star picker.
export function StarInput({ value, onChange, size = 28 }: { value: number; onChange: (value: number) => void; size?: number }) {
  const { t } = useI18n();
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div className="flex gap-1" role="radiogroup" aria-label={t.stars.rating} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={t.stars.nStars(n)}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          className="rounded p-0.5 transition-transform hover:scale-110"
        >
          <Star size={size} className={n <= shown ? "fill-amber text-amber-500" : "text-line-strong"} />
        </button>
      ))}
    </div>
  );
}
