"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "./AuthShell";
import { FieldGroup, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/I18nProvider";
import { safeNext, storeHref, useStoreMode } from "@/lib/store-mode";
import { Camera, ShieldCheck } from "lucide-react";

// `next` is where to go once signed in, e.g. back to the product a store
// viewer was about to buy.
export function RegisterForm({ next }: { next?: string }) {
  const router = useRouter();
  const storeId = useStoreMode();
  const destination = safeNext(next) ?? (storeId ? storeHref(storeId) : "/");
  const { register } = useAuth();
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [buildingName, setBuildingName] = useState("Greenview Towers");
  const [proofFile, setProofFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    name.trim() && email.trim() && password.length >= 6 && unitNumber.trim() && buildingName.trim() && proofFile;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await register({ name, email, password, unitNumber, buildingName });
      router.push(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.register.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={t.auth.register.title}
      subtitle={t.auth.register.subtitle}
      footer={
        <>
          {t.auth.register.alreadyVerified}{" "}
          <Link href={safeNext(next) ? `/login?next=${encodeURIComponent(destination)}` : "/login"} className="font-semibold text-amber-600 hover:underline">
            {t.auth.register.signIn}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-400">{t.auth.register.profileSetup}</h2>
        <FieldGroup label={t.auth.register.name}>
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder={t.auth.register.namePlaceholder} />
        </FieldGroup>
        <FieldGroup label={t.auth.email}>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.auth.emailPlaceholder}
          />
        </FieldGroup>
        <FieldGroup label={t.auth.password}>
          <Input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.auth.register.passwordPlaceholder}
          />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label={t.auth.register.building}>
            <Input required value={buildingName} onChange={(e) => setBuildingName(e.target.value)} />
          </FieldGroup>
          <FieldGroup label={t.auth.register.unitNumber}>
            <Input required value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="12B" />
          </FieldGroup>
        </div>

        <Card className="mt-2 mb-5">
          <CardBody className="text-center">
            <ShieldCheck className="mx-auto mb-2 text-amber-600" size={22} />
            <p className="mb-1 text-sm font-bold text-ink">{t.auth.register.addressVerification}</p>
            <p className="mb-3 text-xs text-ink-400">
              {t.auth.register.addressVerificationHint(buildingName || t.common.yourBuilding)}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setProofFile(e.target.files?.[0]?.name ?? null)}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <Camera size={14} /> {proofFile ? t.auth.register.replacePhoto : t.auth.register.uploadPhoto}
            </Button>
            {proofFile && <p className="mt-2 text-xs font-medium text-success">{t.auth.register.uploaded(proofFile)}</p>}
          </CardBody>
        </Card>

        {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}

        <Button type="submit" fullWidth disabled={!canSubmit || submitting}>
          {submitting ? t.auth.register.submitting : t.auth.register.submit}
        </Button>
        {!proofFile && (
          <p className="mt-2 text-center text-xs text-ink-400">
            {t.auth.register.verificationRequired}
          </p>
        )}
      </form>
    </AuthShell>
  );
}
