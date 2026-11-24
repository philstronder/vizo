"use client";

import { useEffect, useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import {
  approveResidency,
  fetchResidencyRequests,
  rejectResidency,
  type ResidencyRequest,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { FieldGroup, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/i18n/I18nProvider";
import { errorMessage } from "@/lib/error-message";
import { formatDate } from "@/lib/format";

// The proof-of-residency queue: building admins approve or reject the people
// signing up to their condominiums (platform admins see every building's).
export function VerificationsView() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tv = t.verifications;
  const [requests, setRequests] = useState<ResidencyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchResidencyRequests()
      .then((rows) => {
        if (active) setRequests(rows);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const buildings = user?.isAdmin
    ? null
    : (user?.buildingAdminOf ?? []).map((c) => c.name).join(", ");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-black text-ink">{tv.title}</h1>
      <p className="mt-1 mb-6 text-sm text-ink-400">
        {buildings ? tv.subtitleFor(buildings) : tv.subtitleAll}
      </p>

      {loading ? (
        <p className="py-14 text-center text-sm text-ink-400">{tv.loading}</p>
      ) : loadFailed ? (
        <p className="py-14 text-center text-sm text-danger">{tv.loadError}</p>
      ) : requests.length === 0 ? (
        <Card>
          <CardBody className="py-14 text-center">
            <ShieldCheck className="mx-auto mb-2 text-success" size={24} />
            <p className="font-semibold text-ink">{tv.emptyTitle}</p>
            <p className="text-sm text-ink-400">{tv.emptyHint}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {requests.map((r) => (
            <RequestCard
              key={r.userId}
              request={r}
              onDone={() =>
                setRequests((prev) => prev.filter((p) => p.userId !== r.userId))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request,
  onDone,
}: {
  request: ResidencyRequest;
  onDone: () => void;
}) {
  const { locale, t } = useI18n();
  const tv = t.verifications;
  const [rejecting, setRejecting] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (err) {
      setError(errorMessage(err, t, locale, tv.reviewError));
      setBusy(false);
    }
  }

  const unit = [
    request.buildingBlock && tv.block(request.buildingBlock),
    request.unitNumber && t.common.unit(request.unitNumber),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article aria-label={request.name}>
        <Card>
          <CardBody>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="sm:w-56 sm:shrink-0">
                {request.proofPhoto ? (
                  <button
                    type="button"
                    onClick={() => setEnlarged(true)}
                    title={tv.openPhoto}
                    className="block w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- a data URL from the API */}
                    <img
                      src={request.proofPhoto}
                      alt={tv.proofOf(request.name)}
                      className="max-h-56 w-full cursor-zoom-in rounded-lg border border-line bg-cream-100 object-contain"
                    />
                  </button>
                ) : (
                  <p className="rounded-lg border border-dashed border-line p-6 text-center text-xs text-ink-400">
                    {tv.noPhoto}
                  </p>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <Avatar name={request.name} size={36} />
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{request.name}</p>
                    <p className="truncate text-xs text-ink-400">
                      {request.email}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-ink-400">{tv.building}</dt>
                    <dd className="font-medium text-ink">
                      {request.buildingName}
                    </dd>
                  </div>
                  {unit && (
                    <div className="flex gap-2">
                      <dt className="text-ink-400">{tv.unit}</dt>
                      <dd className="font-medium text-ink">{unit}</dd>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <dt className="text-ink-400">{tv.sent}</dt>
                    <dd className="text-ink">
                      {formatDate(request.submittedAt, locale)}
                    </dd>
                  </div>
                </dl>

                {rejecting ? (
                  <form
                    className="mt-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void decide(() =>
                        rejectResidency(
                          request.userId,
                          reason.trim() || undefined,
                        ),
                      );
                    }}
                  >
                    <FieldGroup label={tv.reason}>
                      <Textarea
                        value={reason}
                        maxLength={500}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={tv.reasonPlaceholder}
                      />
                    </FieldGroup>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        variant="danger"
                        size="sm"
                        disabled={busy}
                      >
                        {tv.confirmReject}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => setRejecting(false)}
                      >
                        {tv.cancel}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        decide(() => approveResidency(request.userId))
                      }
                    >
                      <Check size={14} /> {tv.approve}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => setRejecting(true)}
                    >
                      <X size={14} /> {tv.reject}
                    </Button>
                  </div>
                )}
                {error && (
                  <p className="mt-2 text-sm font-medium text-danger">{error}</p>
                )}
              </div>
            </div>
          </CardBody>
          {request.proofPhoto && (
            <Modal
              open={enlarged}
              onClose={() => setEnlarged(false)}
              title={tv.proofOf(request.name)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a data URL from the API */}
              <img
                src={request.proofPhoto}
                alt={tv.proofOf(request.name)}
                className="w-full rounded-lg object-contain"
              />
            </Modal>
          )}
        </Card>
    </article>
  );
}
