"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { checkout, fetchListing } from "@/lib/api";
import { Card, CardBody } from "@/components/ui/Card";
import { FieldGroup, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PlaceholderImage } from "@/components/listings/PlaceholderImage";
import { formatCurrency } from "@/lib/format";
import { CreditCard, MapPin } from "lucide-react";
import type { Listing } from "@/types";
import { useI18n } from "@/i18n/I18nProvider";

export function CheckoutView({ listingId }: { listingId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  const [pickupLocation, setPickupLocation] = useState("Lobby");
  const [pickupTime, setPickupTime] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchListing(listingId)
      .then(setListing)
      .catch(() => setListing(null))
      .finally(() => setLoading(false));
  }, [listingId]);

  if (loading) return null;

  if (!listing) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="mb-2 text-xl font-bold text-ink">{t.checkout.notFound}</h1>
        <Button href="/">{t.common.backToMarketplace}</Button>
      </div>
    );
  }

  const price = listing.type === "auction" ? listing.currentBid ?? 0 : listing.price ?? 0;
  const fees = 0;
  const total = price + fees;
  const isAuctionWin = listing.type === "auction" && user && listing.maxBidderId === user.id;

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await checkout({
        listingId,
        pickupLocation,
        pickupTime: pickupTime || undefined,
      });
      router.push("/orders");
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
            </div>
          </CardBody>
        </Card>

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
            <FieldGroup label={t.checkout.preferredTime} hint={t.checkout.preferredTimeHint}>
              <Input value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} placeholder={t.checkout.preferredTimePlaceholder} />
            </FieldGroup>
          </CardBody>
        </Card>

        <Card className="mb-6">
          <CardBody>
            <h2 className="mb-3 flex items-center gap-1.5 font-bold text-ink">
              <CreditCard size={16} /> {t.checkout.paymentMethod}
            </h2>
            <FieldGroup label={t.checkout.cardNumber}>
              <Input
                required
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="4242 4242 4242 4242"
                inputMode="numeric"
              />
            </FieldGroup>
            <p className="text-xs text-ink-400">{t.checkout.secureNote}</p>
          </CardBody>
        </Card>

        {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}

        <Button type="submit" fullWidth size="lg" disabled={submitting}>
          {submitting ? t.checkout.processing : t.checkout.confirmAndPay(formatCurrency(total, locale))}
        </Button>
      </form>
    </div>
  );
}
