"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { FieldGroup, Input, Checkbox } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/format";
import type { Listing } from "@/types";
import { useI18n } from "@/i18n/I18nProvider";
import { errorMessage } from "@/lib/error-message";

export function PlaceBidModal({
  listing,
  open,
  onClose,
  onSubmit,
}: {
  listing: Listing;
  open: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => Promise<void>;
}) {
  const { locale, t } = useI18n();
  const minBid = (listing.currentBid ?? listing.startingPrice ?? 0) + 1;
  const [amount, setAmount] = useState(minBid);
  const [showBidderNames, setShowBidderNames] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amount < minBid) {
      setError(t.bids.minError(formatCurrency(minBid, locale)));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(amount);
      onClose();
    } catch (err) {
      setError(errorMessage(err, t, locale, t.bids.error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t.bids.modalTitle}>
      <form onSubmit={handleSubmit}>
        <FieldGroup label={t.bids.yourBid(formatCurrency(minBid, locale))}>
          <Input
            type="number"
            min={minBid}
            step={1}
            value={amount}
            onChange={(e) => {
              setError(null);
              setAmount(Number(e.target.value));
            }}
            autoFocus
          />
        </FieldGroup>

        {error && <p className="mb-3 text-xs font-medium text-danger">{error}</p>}

        <div className="mb-4 rounded-lg bg-cream-100 px-3.5 py-3 text-xs text-ink-600 space-y-1">
          <p>
            {t.bids.currentBid}{" "}
            <span className="font-semibold text-ink">
              {formatCurrency(listing.currentBid ?? listing.startingPrice ?? 0, locale)}
            </span>{" "}
            &middot; {t.listing.bidCount(listing.bidCount ?? 0)}
          </p>
          <p>{t.bids.minIncrement(formatCurrency(1, locale))}</p>
        </div>

        <Checkbox
          label={t.bids.showName}
          checked={showBidderNames}
          onChange={(e) => setShowBidderNames(e.target.checked)}
          className="mb-4"
        />

        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? t.bids.submitting : t.bids.submit}
        </Button>
      </form>
    </Modal>
  );
}
