import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Tone = "success" | "danger" | "info" | "amber" | "neutral";

const toneClasses: Record<Tone, string> = {
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  amber: "bg-amber-100 text-amber-600",
  neutral: "bg-cream-100 text-ink-600",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
