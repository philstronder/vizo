"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { checkout, fetchListing, fetchWallet } from "@/lib/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Checkbox, FieldGroup, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PlaceholderImage } from "@/components/listings/PlaceholderImage";
import { formatCurrency, toDateTimeLocalValue } from "@/lib/format";
import { CreditCard, MapPin, ShieldCheck, Wallet } from "lucide-react";
import type { Listing } from "@/types";
import { useI18n } from "@/i18n/I18nProvider";
import { storeHref, useStoreMode } from "@/lib/store-mode";

export function CheckoutView({ listingId }: { listingId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const storeMode = useStoreMode();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  const [pickupLocation, setPickupLocation] = useState("Lobby");
  const [meetupAt, setMeetupAt] = useState("");
  const [creditBalance, setCreditBalance] = useState(0);
  const [useCredits, setUseCredits] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchListing(listingId)
      .then(setListing)
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [listingId]);

  useEffect(() => {
    if (!user) return;
    fetchWallet()
      .then((wallet) => setCreditBalance(wallet.balance))
      .catch(() => setCreditBalance(0));
  }, [user]);

  // Store-mode viewers can only buy from their store.
  const outsideStore = !!storeMode && !!listing && listing.storeId !== storeMode;
  useEffect(() => {
    if (outsideStore) router.replace(storeHref(storeMode!));
  }, [outsideStore, storeMode, router]);

  if (loading || outsideStore) return null;

  if (!listing) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="mb-2 text-xl font-bold text-ink">{t.checkout.notFound}</h1>
        <Button href={storeMode ? storeHref(storeMode) : "/"}>
          {storeMode ? t.common.back : t.common.backToMarketplace}
        </Button>
      </div>
    );
  }

  const price = listing.type === "auction" ? listing.currentBid ?? 0 : listing.price ?? 0;
  const fees = 0;
  const total = price + fees;
  const isStoreProduct = !!listing.storeId;
  const creditsApplied = useCredits ? Math.min(creditBalance, total) : 0;
  const cardAmount = Math.round((total - creditsApplied) * 100) / 100;
  const isAuctionWin = listing.type === "auction" && user && listing.maxBidderId === user.id;

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await checkout({
        listingId,
        // Store products aren't handed over inside a building.
        pickupLocation: isStoreProduct ? undefined : pickupLocation,
        // datetime-local values are in the buyer's time zone; send them as UTC.
        meetupAt: isStoreProduct ? undefined : new Date(meetupAt).toISOString(),
        useCredits: creditsApplied > 0,
      });
      // Store-mode viewers stay in the store; everyone else tracks it in Orders.
      router.push(storeMode ? `${storeHref(storeMode)}?purchased=1` : "/orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.checkout.error);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-black text-ink">{t.checkout.title}</h1>
      <p className="mb-6 text-sm text-ink-400">
        {isAuctionWin ? t.checkout.wonAuction : t.checkout.review}
      </p>

      <Card className="mb-4">
        <CardBody className="flex items-center gap-3">
          <PlaceholderImage
            seed={listing.images[0] ?? listing.id}
            category={listing.category}
            className="h-16 w-16 shrink-0 rounded-lg"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink line-clamp-1">{listing.title}</p>
            <p className="text-xs text-ink-400">{t.common.sellerName(listing.sellerName)}</p>
          </div>
          <p className="font-bold text-ink">{formatCurrency(price, locale)}</p>
        </CardBody>
      </Card>

      <form onSubmit={handleConfirm}>
        <Card className="mb-4">
          <CardBody>
            <h2 className="mb-3 font-bold text-ink">{t.checkout.summary}</h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-ink-600">
                <span>{t.checkout.price}</span>
                <span>{formatCurrency(price, locale)}</span>
              </div>
              <div className="flex justify-between text-ink-600">
                <span>{t.checkout.fees}</span>
                <span>{fees === 0 ? t.checkout.free : formatCurrency(fees, locale)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5 font-bold text-ink">
                <span>{t.checkout.total}</span>
                <span>{formatCurrency(total, locale)}</span>
              </div>
              {creditsApplied > 0 && (
                <>
                  <div className="flex justify-between text-ink-600">
                    <span>{t.checkout.paidWithCredits}</span>
                    <span>−{formatCurrency(creditsApplied, locale)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-ink">
                    <span>{t.checkout.toPayByCard}</span>
                    <span>{formatCurrency(cardAmount, locale)}</span>
                  </div>
                </>
              )}
            </div>
          </CardBody>
        </Card>

        {!isStoreProduct && (
          <Card className="mb-4">
            <CardBody>
              <h2 className="mb-3 flex items-center gap-1.5 font-bold text-ink">
                <MapPin size={16} /> {t.checkout.pickupDetails}
              </h2>
              <p className="mb-3 text-xs text-ink-400">
                {t.checkout.pickupWithin(user?.buildingName ?? t.common.yourBuilding)}
              </p>
              <FieldGroup label={t.checkout.pickupLocation}>
                <Select value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)}>
                  {Object.entries(t.checkout.pickupOptions).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </FieldGroup>
              <FieldGroup label={t.checkout.meetupTime} htmlFor="meetup-at" hint={t.checkout.meetupTimeHint} className="mb-0">
                <Input
                  id="meetup-at"
                  type="datetime-local"
                  required
                  min={toDateTimeLocalValue(new Date())}
                  value={meetupAt}
                  onChange={(e) => setMeetupAt(e.target.value)}
                />
              </FieldGroup>
            </CardBody>
          </Card>
        )}

        <Card className="mb-6">
          <CardBody>
            <h2 className="mb-3 flex items-center gap-1.5 font-bold text-ink">
              <CreditCard size={16} /> {t.checkout.paymentMethod}
            </h2>
            {creditBalance > 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-cream-100 px-3 py-2.5">
                <Wallet size={15} className="shrink-0 text-ink-600" />
                <Checkbox
                  checked={useCredits}
                  onChange={(e) => setUseCredits(e.target.checked)}
                  label={t.checkout.useCredits(formatCurrency(creditBalance, locale))}
                />
              </div>
            )}
            {cardAmount > 0 ? (
              <FieldGroup label={t.checkout.cardNumber}>
                <Input
                  required
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  inputMode="numeric"
                />
              </FieldGroup>
            ) : (
              <p className="mb-4 text-sm text-ink-600">{t.checkout.coveredByCredits}</p>
            )}
            <p className="text-xs text-ink-400">{t.checkout.secureNote}</p>
            {!isStoreProduct && (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-600">
                <ShieldCheck size={14} className="mt-px shrink-0 text-success" />
                {t.checkout.escrowNote}
              </p>
            )}
          </CardBody>
        </Card>

        {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}

        <Button type="submit" fullWidth size="lg" disabled={submitting}>
          {submitting ? t.checkout.processing : t.checkout.confirmAndPay(formatCurrency(cardAmount > 0 ? cardAmount : total, locale))}
        </Button>
      </form>
    </div>
  );
}
