"use client";

import { useCallback, useEffect, useState } from "react";
import type { Bid, Listing, Message } from "@/types";
import { PlaceholderImage } from "./PlaceholderImage";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { StarRating } from "@/components/ui/StarRating";
import { Countdown } from "./Countdown";
import { BidHistory } from "./BidHistory";
import { PlaceBidModal } from "./PlaceBidModal";
import { MessageThread } from "./MessageThread";
import { formatCurrency, formatDate } from "@/lib/format";
import { BadgeCheck, Gavel, MapPin, Tag } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  fetchBids,
  fetchListing,
  fetchMessages,
  placeBid as apiPlaceBid,
  postMessage,
} from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";

export function ListingDetailView({ listingId }: { listingId: string }) {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const [listing, setListing] = useState<Listing | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [bidModalOpen, setBidModalOpen] = useState(false);
  const router = useRouter();

  const load = useCallback(() => {
    return Promise.all([fetchListing(listingId), fetchMessages(listingId)])
      .then(([listingData, messagesData]) => {
        setListing(listingData);
        setMessages(messagesData);
        if (listingData.type === "auction") {
          return fetchBids(listingId).then(setBids);
        }
      })
      .catch(() => setNotFoundState(true))
      .finally(() => setLoading(false));
  }, [listingId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return null;

  if (notFoundState || !listing) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="mb-2 text-xl font-bold text-ink">{t.detail.notFoundTitle}</h1>
        <p className="mb-6 text-sm text-ink-400">{t.detail.notFoundHint}</p>
        <Button href="/">{t.common.backToMarketplace}</Button>
      </div>
    );
  }

  const isAuction = listing.type === "auction";
  const isOwner = user?.id === listing.sellerId;
  const ended = listing.status !== "active";

  async function handleBid(amount: number) {
    await apiPlaceBid(listingId, amount);
    await load();
  }

  async function handleSendMessage(body: string) {
    await postMessage(listingId, body);
    setMessages(await fetchMessages(listingId));
  }

  function handleBuyOrBid() {
    if (!user) {
      router.push("/login");
      return;
    }
    if (isAuction) {
      setBidModalOpen(true);
    } else {
      router.push(`/checkout/${listing!.id}`);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <PlaceholderImage
            seed={listing.images[0] ?? listing.id}
            category={listing.category}
            className="aspect-[4/3] w-full rounded-2xl"
          />
          <div className="mt-6">
            <h2 className="mb-2 font-bold text-ink">{t.detail.itemDetails}</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">{listing.description}</p>
          </div>

          <div className="mt-6">
            <MessageThread messages={messages} onSend={handleSendMessage} />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            {isAuction ? (
              <Badge tone="amber">
                <Gavel size={12} /> {t.listing.auction}
              </Badge>
            ) : (
              <Badge tone="info">
                <Tag size={12} /> {t.listing.directSale}
              </Badge>
            )}
            <Badge tone="neutral">{t.listing.condition[listing.condition]}</Badge>
            {ended && <Badge tone="danger">{listing.status === "sold" ? t.listing.status.sold : t.listing.status.ended}</Badge>}
          </div>

          <h1 className="mb-1 text-2xl font-black text-ink">{listing.title}</h1>
          <p className="mb-5 flex items-center gap-1 text-sm text-ink-400">
            <MapPin size={14} /> {listing.sellerBuildingName ?? t.common.community}
          </p>

          <Card>
            <CardBody>
              {isAuction ? (
                <>
                  <div className="mb-4 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-ink-400">
                        {t.listing.currentBid} &middot; {t.listing.bidCount(listing.bidCount ?? 0)}
                      </p>
                      <p className="text-3xl font-black text-ink">
                        {formatCurrency(listing.currentBid ?? listing.startingPrice ?? 0, locale)}
                      </p>
                    </div>
                    {listing.auctionEndsAt && (
                      <div className="text-right">
                        <p className="text-xs text-ink-400">{t.detail.timeLeft}</p>
                        <Countdown endsAt={listing.auctionEndsAt} className="font-semibold" />
                      </div>
                    )}
                  </div>

                  {ended ? (
                    <Button fullWidth disabled>
                      {t.detail.auctionEnded}
                    </Button>
                  ) : isOwner ? (
                    <Button fullWidth disabled>
                      {t.detail.yourListing}
                    </Button>
                  ) : (
                    <Button fullWidth onClick={handleBuyOrBid}>
                      {t.detail.placeBid}
                    </Button>
                  )}
                  <p className="mt-2 text-center text-xs text-ink-400">
                    {t.detail.youStatus(user && listing.maxBidderId === user.id ? t.detail.highestBidder : t.detail.notBidding)}
                  </p>

                  <div className="mt-5 border-t border-line pt-4">
                    <h3 className="mb-3 font-bold text-ink text-sm">{t.detail.bidHistory}</h3>
                    <BidHistory bids={bids} />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-ink-400">{t.listing.fixedPrice}</p>
                  <p className="mb-4 text-3xl font-black text-ink">{formatCurrency(listing.price ?? 0, locale)}</p>
                  {ended ? (
                    <Button fullWidth disabled>
                      {listing.status === "sold" ? t.listing.status.sold : t.detail.noLongerAvailable}
                    </Button>
                  ) : isOwner ? (
                    <Button fullWidth disabled>
                      {t.detail.yourListing}
                    </Button>
                  ) : (
                    <Button fullWidth onClick={handleBuyOrBid}>
                      {t.detail.buyNow}
                    </Button>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          <Link href={isOwner ? "/profile" : "#"}>
            <Card className="mt-4">
              <CardBody className="flex items-center gap-3">
                <Avatar name={listing.sellerName} size={44} />
                <div className="min-w-0">
                  <p className="flex items-center gap-1 font-semibold text-ink">
                    {listing.sellerName}
                    {listing.sellerVerified && <BadgeCheck size={15} className="text-info" />}
                  </p>
                  <p className="text-xs text-ink-400">
                    {listing.sellerUnitNumber && <>{t.common.unit(listing.sellerUnitNumber)} &middot; </>}
                    {listing.sellerMemberSince && <>{t.common.memberSince(formatDate(listing.sellerMemberSince, locale))}</>}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-400">
                    <StarRating value={listing.sellerRating ?? 0} />
                    {listing.sellerReviewCount ? (
                      <>
                        <span className="font-semibold text-ink">{listing.sellerRating!.toFixed(1)}</span>
                        <span>{t.detail.ratingCount(listing.sellerReviewCount)}</span>
                      </>
                    ) : (
                      <span>{t.detail.noRatings}</span>
                    )}
                  </p>
                </div>
              </CardBody>
            </Card>
          </Link>
        </div>
      </div>

      {isAuction && (
        <PlaceBidModal
          listing={listing}
          open={bidModalOpen}
          onClose={() => setBidModalOpen(false)}
          onSubmit={handleBid}
        />
      )}
    </div>
  );
}
