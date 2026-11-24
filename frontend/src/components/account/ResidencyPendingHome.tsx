"use client";

import { useState } from "react";
import { Clock, ShieldX, UserRound } from "lucide-react";
import { ProofOfResidencyField } from "@/components/account/ProofOfResidencyField";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/I18nProvider";
import { errorMessage } from "@/lib/error-message";

// What residents see instead of community pages until a building admin
// approves their proof of residency. After a rejection they can send a new photo.
export function ResidencyPendingHome() {
  const { user, resubmitResidencyProof } = useAuth();
  const { locale, t } = useI18n();
  const [photo, setPhoto] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  const rejected = user.verificationStatus === "rejected";
  const building = user.buildingName ?? t.common.yourBuilding;

  async function handleResubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!photo) return;
    setSending(true);
    setError(null);
    try {
      await resubmitResidencyProof(photo);
      setPhoto(null);
    } catch (err) {
      setError(errorMessage(err, t, locale, t.residency.resubmitError));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <Card>
        <CardBody className="text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-ink text-amber">
            {rejected ? <ShieldX size={22} /> : <Clock size={22} />}
          </span>
          <h1 className="mb-2 text-xl font-black text-ink">
            {rejected ? t.residency.rejectedTitle : t.residency.pendingTitle}
          </h1>
          <p className="mb-4 text-sm text-ink-400">
            {rejected ? t.residency.rejectedHint(building) : t.residency.pendingHint(building)}
          </p>
          {rejected && user.verificationRejectionReason && (
            <p className="mb-4 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
              {t.residency.reason(user.verificationRejectionReason)}
            </p>
          )}

          {rejected ? (
            <form onSubmit={handleResubmit} className="text-left">
              <ProofOfResidencyField buildingName={building} value={photo} onChange={setPhoto} />
              {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}
              <Button type="submit" fullWidth disabled={!photo || sending}>
                {sending ? t.residency.sending : t.residency.sendNewPhoto}
              </Button>
            </form>
          ) : (
            <Button href="/profile" variant="secondary">
              <UserRound size={16} /> {t.viewer.profile}
            </Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
