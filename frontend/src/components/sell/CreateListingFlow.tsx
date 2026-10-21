"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { FieldGroup, Input, Textarea, Select, Radio } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PhotoUploader } from "./PhotoUploader";
import { useAuth } from "@/lib/auth-context";
import { createListing } from "@/lib/api";
import type { ListingCategory, ListingCondition, ListingType } from "@/types";
import { Check, Gavel, Tag } from "lucide-react";
import { cn } from "@/lib/cn";
import { currencySymbol } from "@/lib/format";
import { useI18n } from "@/i18n/I18nProvider";
import { storeHref } from "@/lib/store-mode";

export function CreateListingFlow({ storeId }: { storeId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const steps = t.sell.steps;
  const [step, setStep] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ListingCategory>("furniture");
  // TV show store products are always new, so their condition isn't asked for.
  const [condition, setCondition] = useState<ListingCondition>(storeId ? "new" : "used-good");
  const [type, setType] = useState<ListingType>("direct");

  const [price, setPrice] = useState<number | "">("");
  const [contactInfo, setContactInfo] = useState("");
  const [startingPrice, setStartingPrice] = useState<number | "">("");
  const [duration, setDuration] = useState<"1" | "3" | "7">("3");
  const [photos, setPhotos] = useState<string[]>([]);
  // Store products can stock several units; community listings are single items.
  const [quantity, setQuantity] = useState<number | "">(1);

  const step1Valid = title.trim().length > 0 && description.trim().length > 0;
  const step2Valid =
    (type === "direct" ? price !== "" && Number(price) > 0 : startingPrice !== "" && Number(startingPrice) > 0) &&
    (!storeId || (Number.isInteger(quantity) && Number(quantity) >= 1));

  async function handlePublish() {
    setPublishing(true);
    setError(null);
    try {
      const listing = await createListing({
        title: title.trim(),
        description: description.trim(),
        category,
        condition,
        images: photos,
        type,
        price: type === "direct" ? Number(price) : undefined,
        startingPrice: type === "auction" ? Number(startingPrice) : undefined,
        auctionDurationDays: type === "auction" ? (Number(duration) as 1 | 3 | 7) : undefined,
        storeId,
        quantity: storeId ? Number(quantity) : undefined,
      });
      router.push(storeId ? storeHref(storeId) : `/listing/${listing.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.sell.error);
      setPublishing(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-black text-ink">{storeId ? t.sell.storeTitle : t.sell.title}</h1>
      <p className="mb-6 text-sm text-ink-400">
        {storeId ? t.sell.storeSubtitle : t.sell.subtitle(user?.buildingName)}
      </p>

      <div className="mb-6 flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                i < step
                  ? "bg-success text-white"
                  : i === step
                  ? "bg-amber text-ink"
                  : "bg-cream-100 text-ink-400"
              )}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span className={cn("text-sm font-medium", i === step ? "text-ink" : "text-ink-400")}>
              {label}
            </span>
            {i < steps.length - 1 && <div className="mx-2 h-px flex-1 bg-line" />}
          </div>
        ))}
      </div>

      <Card>
        <CardBody>
          {step === 0 && (
            <div>
              <FieldGroup label={t.sell.itemName}>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.sell.itemNamePlaceholder} />
              </FieldGroup>
              <FieldGroup label={t.sell.description}>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.sell.descriptionPlaceholder}
                />
              </FieldGroup>
              <div className={cn("grid gap-4", storeId ? "grid-cols-1" : "grid-cols-2")}>
                <FieldGroup label={t.sell.category}>
                  <Select value={category} onChange={(e) => setCategory(e.target.value as ListingCategory)}>
                    {(Object.keys(t.listing.category) as ListingCategory[]).map((c) => (
                      <option key={c} value={c}>
                        {t.listing.category[c]}
                      </option>
                    ))}
                  </Select>
                </FieldGroup>
                {!storeId && (
                  <FieldGroup label={t.sell.condition}>
                    <Select value={condition} onChange={(e) => setCondition(e.target.value as ListingCondition)}>
                      {(Object.keys(t.listing.condition) as ListingCondition[]).map((c) => (
                        <option key={c} value={c}>
                          {t.listing.condition[c]}
                        </option>
                      ))}
                    </Select>
                  </FieldGroup>
                )}
              </div>

              {/* TV show store products are always direct sales, so there's no type to pick. */}
              {!storeId && (
                <FieldGroup label={t.sell.selectType}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
                        type === "direct" ? "border-amber-500 bg-amber-100/40" : "border-line-strong"
                      )}
                    >
                      <Radio label="" name="type" checked={type === "direct"} onChange={() => setType("direct")} />
                      <div>
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                          <Tag size={14} /> {t.listing.directSale}
                        </p>
                        <p className="text-xs text-ink-400">{t.sell.directHint}</p>
                      </div>
                    </label>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
                        type === "auction" ? "border-amber-500 bg-amber-100/40" : "border-line-strong"
                      )}
                    >
                      <Radio label="" name="type" checked={type === "auction"} onChange={() => setType("auction")} />
                      <div>
                        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                          <Gavel size={14} /> {t.sell.auctionLabel}
                        </p>
                        <p className="text-xs text-ink-400">{t.sell.auctionHint}</p>
                      </div>
                    </label>
                  </div>
                </FieldGroup>
              )}

              <Button fullWidth disabled={!step1Valid} onClick={() => setStep(1)}>
                {t.common.next}
              </Button>
            </div>
          )}

          {step === 1 && type === "direct" && (
            <div>
              <h2 className="mb-4 font-bold text-ink">{t.sell.directDetails}</h2>
              <FieldGroup label={t.sell.setPrice(currencySymbol(locale))}>
                <Input
                  type="number"
                  min={1}
                  value={price}
                  onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="75"
                />
              </FieldGroup>
              {storeId && (
                <FieldGroup label={t.sell.quantity} hint={t.sell.quantityHint}>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </FieldGroup>
              )}
              <FieldGroup label={t.sell.photos}>
                <PhotoUploader photos={photos} onChange={setPhotos} />
              </FieldGroup>
              {/* TV show store products don't need pickup coordination with a seller. */}
              {!storeId && (
                <FieldGroup label={t.sell.contactInfo} hint={t.sell.contactHint}>
                  <Input
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    placeholder={t.sell.contactPlaceholder}
                  />
                </FieldGroup>
              )}
              {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep(0)}>
                  {t.common.back}
                </Button>
                <Button fullWidth disabled={!step2Valid || publishing} onClick={handlePublish}>
                  {publishing ? t.sell.publishing : t.sell.publishListing}
                </Button>
              </div>
            </div>
          )}

          {step === 1 && type === "auction" && (
            <div>
              <h2 className="mb-4 font-bold text-ink">{t.sell.auctionDetails}</h2>
              <FieldGroup label={t.sell.startingPrice(currencySymbol(locale))}>
                <Input
                  type="number"
                  min={1}
                  value={startingPrice}
                  onChange={(e) => setStartingPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="10"
                />
              </FieldGroup>
              <FieldGroup label={t.sell.duration}>
                <div className="flex gap-2">
                  {(["1", "3", "7"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={cn(
                        "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        duration === d
                          ? "border-amber-500 bg-amber text-ink"
                          : "border-line-strong bg-paper text-ink-600 hover:bg-cream-100"
                      )}
                    >
                      {d === "1" ? t.sell.oneDay : d === "3" ? t.sell.threeDays : t.sell.oneWeek}
                    </button>
                  ))}
                </div>
              </FieldGroup>
              <FieldGroup label={t.sell.photos}>
                <PhotoUploader photos={photos} onChange={setPhotos} />
              </FieldGroup>
              {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep(0)}>
                  {t.common.back}
                </Button>
                <Button fullWidth disabled={!step2Valid || publishing} onClick={handlePublish}>
                  {publishing ? t.sell.publishing : t.sell.publishAuction}
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
