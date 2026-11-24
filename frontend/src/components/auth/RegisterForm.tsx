"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "./AuthShell";
import { FieldGroup, Input } from "@/components/ui/Field";
import { CondominiumSelect } from "@/components/account/CondominiumSelect";
import {
  DeliveryAddressFields,
  EMPTY_ADDRESS,
  isAddressComplete,
  trimAddress,
} from "@/components/account/DeliveryAddressFields";
import { ProofOfResidencyField } from "@/components/account/ProofOfResidencyField";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/I18nProvider";
import { errorMessage } from "@/lib/error-message";
import { safeNext, useStoreMode } from "@/lib/store-mode";
import { ViewerRegisterForm } from "./ViewerRegisterForm";

// `next` is where to go once signed in, e.g. back to the product a store
// viewer was about to buy. Viewers who came from a TV show's store get the
// viewer sign-up; everyone else signs up as a building resident.
export function RegisterForm({ next }: { next?: string }) {
  const storeId = useStoreMode();
  if (storeId === undefined) return null;
  return storeId ? <ViewerRegisterForm storeId={storeId} next={next} /> : <ResidentRegisterForm next={next} />;
}

function ResidentRegisterForm({ next }: { next?: string }) {
  const router = useRouter();
  const destination = safeNext(next) ?? "/";
  const { register } = useAuth();
  const { locale, t } = useI18n();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [buildingName, setBuildingName] = useState("");
  // Set when the resident's condominium is missing from the list.
  const [creatingCondominium, setCreatingCondominium] = useState(false);
  const [newCondominiumName, setNewCondominiumName] = useState("");
  const [newCondominiumAddress, setNewCondominiumAddress] = useState(EMPTY_ADDRESS);
  const [buildingBlock, setBuildingBlock] = useState("");
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const condominiumName = creatingCondominium ? newCondominiumName : buildingName;
  const condominiumChosen = creatingCondominium
    ? newCondominiumName.trim() && isAddressComplete(newCondominiumAddress)
    : buildingName.trim();
  const canSubmit =
    name.trim() && email.trim() && password.length >= 6 && unitNumber.trim() && condominiumChosen && proofPhoto;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !proofPhoto) return;
    setSubmitting(true);
    setError(null);
    try {
      await register({
        accountType: "resident",
        name,
        email,
        password,
        unitNumber,
        buildingBlock,
        proofPhoto,
        ...(creatingCondominium
          ? { newCondominium: { name: newCondominiumName.trim(), address: trimAddress(newCondominiumAddress) } }
          : { buildingName }),
      });
      router.push(destination);
    } catch (err) {
      setError(errorMessage(err, t, locale, t.auth.register.error));
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
        {creatingCondominium ? (
          <>
            <FieldGroup label={t.auth.register.newCondominiumName}>
              <Input required value={newCondominiumName} onChange={(e) => setNewCondominiumName(e.target.value)} />
            </FieldGroup>
            <DeliveryAddressFields
              value={newCondominiumAddress}
              onChange={setNewCondominiumAddress}
              withComplement={false}
            />
            <button
              type="button"
              onClick={() => setCreatingCondominium(false)}
              className="mb-4 text-sm font-semibold text-amber-600 hover:underline"
            >
              {t.auth.register.chooseFromList}
            </button>
          </>
        ) : (
          <FieldGroup label={t.auth.register.building}>
            <CondominiumSelect required value={buildingName} onChange={setBuildingName} />
            <p className="mt-1.5 text-xs text-ink-400">
              {t.auth.register.condominiumMissing}{" "}
              <button
                type="button"
                onClick={() => setCreatingCondominium(true)}
                className="font-semibold text-amber-600 hover:underline"
              >
                {t.auth.register.addCondominium}
              </button>
            </p>
          </FieldGroup>
        )}
        {/* The unit only makes sense once there's a condominium to put it in. */}
        {(creatingCondominium || buildingName) && (
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label={t.auth.register.buildingBlock}>
              <Input value={buildingBlock} onChange={(e) => setBuildingBlock(e.target.value)} placeholder="A" />
            </FieldGroup>
            <FieldGroup label={t.auth.register.unitNumber}>
              <Input required value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="12B" />
            </FieldGroup>
          </div>
        )}

        <ProofOfResidencyField
          buildingName={condominiumName.trim() || t.common.yourBuilding}
          value={proofPhoto}
          onChange={setProofPhoto}
        />

        {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}

        <Button type="submit" fullWidth disabled={!canSubmit || submitting}>
          {submitting ? t.auth.register.submitting : t.auth.register.submit}
        </Button>
        {!proofPhoto && (
          <p className="mt-2 text-center text-xs text-ink-400">
            {t.auth.register.verificationRequired}
          </p>
        )}
      </form>
    </AuthShell>
  );
}
