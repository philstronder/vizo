"use client";

import { formatCurrency, formatRelativeTime } from "@/lib/format";
import type { Bid } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { useI18n } from "@/i18n/I18nProvider";

export function BidHistory({ bids }: { bids: Bid[] }) {
  const { locale, t } = useI18n();

  if (bids.length === 0) {
    return <p className="text-sm text-ink-400">{t.bids.empty}</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {bids.map((bid, i) => (
        <li key={bid.id} className="flex items-center gap-3">
          <Avatar name={bid.bidderName} size={28} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">
              <span className="font-semibold">{bid.bidderName}</span>{" "}
              {i === 0 && <span className="text-xs font-medium text-success">&middot; {t.bids.highest}</span>}
            </p>
            <p className="text-xs text-ink-400">{formatRelativeTime(bid.createdAt, locale)}</p>
          </div>
          <span className="font-bold text-ink">{formatCurrency(bid.amount, locale)}</span>
        </li>
      ))}
    </ul>
  );
}
