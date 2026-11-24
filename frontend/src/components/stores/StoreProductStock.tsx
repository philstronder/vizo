"use client";

import { useState } from "react";
import { PackageX, Plus } from "lucide-react";
import { restockListing } from "@/lib/api";
import type { Listing } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { useI18n } from "@/i18n/I18nProvider";
import { errorMessage } from "@/lib/error-message";

// Admin-only stock panel under a store product: shows the units left and adds
// more, which re-publishes the product once it has sold out.
export function StoreProductStock({
  listing,
  onRestocked,
}: {
  listing: Listing;
  onRestocked: (listing: Listing) => void;
}) {
  const { locale, t } = useI18n();
  const [units, setUnits] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const soldOut = listing.status === "sold";
  const valid = Number.isInteger(units) && Number(units) >= 1;

  async function handleRestock() {
    setSaving(true);
    setError(null);
    try {
      onRestocked(await restockListing(listing.id, Number(units)));
      setUnits("");
    } catch (err) {
      setError(errorMessage(err, t, locale, t.store.restockError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("rounded-xl border p-3", soldOut ? "border-danger/30 bg-danger/5" : "border-line-strong")}>
      {soldOut ? (
        <>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-danger">
            <PackageX size={14} /> {t.store.soldOut}
          </p>
          <p className="mt-0.5 text-xs text-ink-400">{t.store.soldOutHint}</p>
        </>
      ) : (
        <p className="text-sm font-semibold text-ink">{t.store.inStock(listing.quantity)}</p>
      )}
      <div className="mt-2 flex gap-2">
        <Input
          type="number"
          min={1}
          step={1}
          value={units}
          onChange={(e) => setUnits(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder={t.store.unitsToAdd}
          aria-label={t.store.unitsToAdd}
        />
        <Button size="sm" className="shrink-0" disabled={!valid || saving} onClick={handleRestock}>
          <Plus size={14} /> {soldOut ? t.store.restockAndPublish : t.store.addUnits}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
