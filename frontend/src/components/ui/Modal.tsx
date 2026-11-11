"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useI18n } from "@/i18n/I18nProvider";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative w-full ${wide ? "max-w-lg" : "max-w-sm"} rounded-2xl border border-line bg-paper p-5 shadow-xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-ink-400 hover:bg-cream-100 hover:text-ink"
            aria-label={t.common.close}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
