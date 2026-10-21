"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "./AuthShell";
import { FieldGroup, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  DeliveryAddressFields,
  EMPTY_ADDRESS,
  isAddressComplete,
  trimAddress,
} from "@/components/account/DeliveryAddressFields";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/I18nProvider";
import { safeNext, storeHref } from "@/lib/store-mode";

// Sign-up for TV show viewers, reached from a store: no building or proof of
// residency, but a phone and an address so store products can be delivered.
export function ViewerRegisterForm({ storeId, next }: { storeId: string; next?: string }) {
  const router = useRouter();
  const destination = safeNext(next) ?? storeHref(storeId);
  const { register } = useAuth();
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    name.trim() && email.trim() && password.length >= 6 && phone.trim().length >= 8 && isAddressComplete(address);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await register({
        accountType: "viewer",
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        deliveryAddress: trimAddress(address),
      });
      router.push(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.viewerRegister.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={t.auth.viewerRegister.title}
      subtitle={t.auth.viewerRegister.subtitle}
      footer={
        <>
          {t.auth.viewerRegister.haveAccount}{" "}
          <Link href={`/login?next=${encodeURIComponent(destination)}`} className="font-semibold text-amber-600 hover:underline">
            {t.auth.register.signIn}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-400">{t.auth.viewerRegister.yourDetails}</h2>
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
        <FieldGroup label={t.address.phone}>
          <Input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.address.phonePlaceholder}
          />
        </FieldGroup>

        <h2 className="mb-3 mt-6 text-sm font-bold uppercase tracking-wide text-ink-400">{t.address.deliveryAddress}</h2>
        <DeliveryAddressFields value={address} onChange={setAddress} />

        {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}

        <Button type="submit" fullWidth disabled={!canSubmit || submitting}>
          {submitting ? t.auth.register.submitting : t.auth.register.submit}
        </Button>
      </form>
    </AuthShell>
  );
}
