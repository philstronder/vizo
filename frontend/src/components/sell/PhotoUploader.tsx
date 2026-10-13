"use client";

import { Camera, X } from "lucide-react";
import { useRef, useState } from "react";
import { fileToCompressedDataUrl } from "@/lib/image";
import { useI18n } from "@/i18n/I18nProvider";

export function PhotoUploader({
  photos,
  onChange,
  max = 5,
}: {
  photos: string[];
  onChange: (photos: string[]) => void;
  max?: number;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setProcessing(true);
    try {
      const accepted = Array.from(files).slice(0, max - photos.length);
      const dataUrls = await Promise.all(accepted.map((f) => fileToCompressedDataUrl(f)));
      onChange([...photos, ...dataUrls]);
    } catch {
      // an unreadable file (corrupt/unsupported) — skip it silently
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {photos.map((src, i) => (
          <div
            key={i}
            className="relative h-20 w-20 overflow-hidden rounded-lg border border-line-strong bg-cream-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={t.photos.alt(i + 1)} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(photos.filter((_, idx) => idx !== i))}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-ink p-0.5 text-cream"
              aria-label={t.photos.remove}
            >
              <X size={10} />
            </button>
          </div>
        ))}
        {photos.length < max && (
          <button
            type="button"
            disabled={processing}
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line-strong text-ink-400 hover:border-amber-500 hover:text-amber-600 disabled:opacity-50"
          >
            <Camera size={18} />
            <span className="text-[10px] font-medium">{processing ? t.photos.adding : t.photos.add}</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="mt-2 text-xs text-ink-400">
        {t.photos.count(photos.length, max)}
      </p>
    </div>
  );
}
