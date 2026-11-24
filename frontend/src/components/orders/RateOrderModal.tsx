"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { FieldGroup, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { StarInput } from "@/components/ui/StarRating";
import { reviewBuyer, reviewOrder } from "@/lib/api";
import type { Order } from "@/types";
import { useI18n } from "@/i18n/I18nProvider";
import { errorMessage } from "@/lib/error-message";

// The buyer rates the seller (target "seller"), or the seller rates the
// buyer (target "buyer"), once the order is completed.
export function RateOrderModal({
  order,
  target,
  open,
  onClose,
  onRated,
}: {
  order: Order;
  target: "seller" | "buyer";
  open: boolean;
  onClose: () => void;
  onRated: (order: Order) => void;
}) {
  const { locale, t } = useI18n();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) {
      setError(t.rate.pickRating);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const submit = target === "seller" ? reviewOrder : reviewBuyer;
      onRated(await submit(order.id, { rating, comment: comment.trim() || undefined }));
      onClose();
    } catch (err) {
      setError(errorMessage(err, t, locale, t.rate.error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t.rate.title(target === "seller" ? order.sellerName : order.buyerName)}>
      <form onSubmit={handleSubmit}>
        <p className="mb-3 text-xs text-ink-400">{target === "seller" ? t.rate.howDidItGo(order.listingTitle) : t.rate.howDidSellingGo(order.listingTitle)}</p>
        <div className="mb-4 flex items-center gap-3">
          <StarInput
            value={rating}
            onChange={(n) => {
              setError(null);
              setRating(n);
            }}
          />
          <span className="text-sm font-medium text-ink-600">{t.rate.labels[rating]}</span>
        </div>

        <FieldGroup label={t.rate.comment}>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            placeholder={target === "seller" ? t.rate.commentPlaceholder : t.rate.buyerCommentPlaceholder}
          />
        </FieldGroup>

        {error && <p className="mb-3 text-xs font-medium text-danger">{error}</p>}

        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? t.common.saving : t.rate.submit}
        </Button>
      </form>
    </Modal>
  );
}
