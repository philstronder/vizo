"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "./AuthShell";
import { FieldGroup, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/I18nProvider";
import { safeNext, storeHref, useStoreMode } from "@/lib/store-mode";

// `next` is where to go once signed in, e.g. back to the product a store
// viewer was about to buy.
export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const storeId = useStoreMode();
  const destination = safeNext(next) ?? (storeId ? storeHref(storeId) : "/");
  const { login } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      router.push(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.login.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={t.auth.login.title}
      subtitle={t.auth.login.subtitle}
      footer={
        <>
          {t.auth.login.newHere}{" "}
          <Link href={safeNext(next) ? `/register?next=${encodeURIComponent(destination)}` : "/register"} className="font-semibold text-amber-600 hover:underline">
            {t.auth.login.verifyResidency}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </FieldGroup>
        {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? t.auth.login.submitting : t.auth.login.submit}
        </Button>
      </form>
    </AuthShell>
  );
}
