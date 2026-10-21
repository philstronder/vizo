"use client";

import Link from "next/link";
import type { Listing } from "@/types";
import { PlaceholderImage } from "./PlaceholderImage";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Countdown } from "./Countdown";
import { formatCurrency } from "@/lib/format";
import { Gavel, Tag } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

export function ListingCard({ listing }: { listing: Listing }) {
  const { locale, t } = useI18n();
  const isAuction = listing.type === "auction";
  // TV show store products are always new, direct-sale items, so condition, seller, sale type and price type are left out.
  const isStoreProduct = listing.storeId !== undefined;

  return (
    <Link href={`/listing/${listing.id}`} className="block group">
      <Card className="overflow-hidden h-full flex flex-col transition-shadow group-hover:shadow-md">
        <div className="relative">
          <PlaceholderImage
            seed={listing.images[0] ?? listing.id}
            category={listing.category}
            className="aspect-[4/3] w-full"
          />
          <div className="absolute top-2 left-2 flex gap-1.5">
            {listing.status === "sold" && (
              <Badge tone={isStoreProduct ? "danger" : "neutral"}>
                {isStoreProduct ? t.store.soldOut : t.listing.status.sold}
              </Badge>
            )}
            {listing.status === "ended" && <Badge tone="danger">{t.listing.status.ended}</Badge>}
            {listing.status === "active" && isAuction && (
              <Badge tone="amber">
                <Gavel size={12} /> {t.listing.auction}
              </Badge>
            )}
            {listing.status === "active" && !isAuction && !isStoreProduct && (
              <Badge tone="info">
                <Tag size={12} /> {t.listing.directSale}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <h3 className="font-semibold text-ink leading-snug line-clamp-1">{listing.title}</h3>
          {!isStoreProduct && (
            <p className="text-xs text-ink-400">
              {t.listing.condition[listing.condition]} &middot; @{listing.sellerName.split(" ")[0]}
            </p>
          )}

          <div className="mt-auto pt-3 flex items-end justify-between">
            {isAuction ? (
              <div>
                <p className="text-xs text-ink-400">
                  {t.listing.currentBid} &middot; {t.listing.bidCount(listing.bidCount ?? 0)}
                </p>
                <p className="text-lg font-bold text-ink">{formatCurrency(listing.currentBid ?? listing.startingPrice ?? 0, locale)}</p>
              </div>
            ) : (
              <div>
                {!isStoreProduct && <p className="text-xs text-ink-400">{t.listing.fixedPrice}</p>}
                <p className="text-lg font-bold text-ink">{formatCurrency(listing.price ?? 0, locale)}</p>
              </div>
            )}
            {isAuction && listing.status === "active" && listing.auctionEndsAt && (
              <Countdown endsAt={listing.auctionEndsAt} className="text-xs font-medium" />
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
