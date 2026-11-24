"use client";

import { useRef, useState } from "react";
import { Camera, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { useI18n } from "@/i18n/I18nProvider";
import { fileToCompressedDataUrl } from "@/lib/image";

// Documents need to stay legible for the building admin reviewing them, so
// they're kept larger than listing photos.
const MAX_DIMENSION = 1600;
const QUALITY = 0.85;

// A photo of a utility bill, lease or ID proving the person lives in
// `buildingName`. Hands the parent the photo as a data URL.
export function ProofOfResidencyField({
  buildingName,
  value,
  onChange,
}: {
  buildingName: string;
  value: string | null;
  onChange: (photo: string | null) => void;
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setFailed(false);
    try {
      onChange(await fileToCompressedDataUrl(file, MAX_DIMENSION, QUALITY));
      setFileName(file.name);
    } catch {
      setFailed(true);
    } finally {
      setReading(false);
      // Picking the same file again should still trigger a change.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card className="mt-2 mb-5">
      <CardBody className="text-center">
        <ShieldCheck className="mx-auto mb-2 text-amber-600" size={22} />
        <p className="mb-1 text-sm font-bold text-ink">{t.auth.register.addressVerification}</p>
        <p className="mb-3 text-xs text-ink-400">{t.auth.register.addressVerificationHint(buildingName)}</p>
        {value && (
          // eslint-disable-next-line @next/next/no-img-element -- a local data URL
          <img
            src={value}
            alt={t.residency.proofAlt}
            className="mx-auto mb-3 max-h-40 rounded-lg border border-line object-contain"
          />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label={t.auth.register.uploadPhoto}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button type="button" variant="secondary" size="sm" disabled={reading} onClick={() => fileRef.current?.click()}>
          <Camera size={14} /> {value ? t.auth.register.replacePhoto : t.auth.register.uploadPhoto}
        </Button>
        {value && fileName && <p className="mt-2 text-xs font-medium text-success">{t.auth.register.uploaded(fileName)}</p>}
        {failed && <p className="mt-2 text-xs font-medium text-danger">{t.residency.unreadablePhoto}</p>}
      </CardBody>
    </Card>
  );
}
