"use client";

import type { ListingCategory, ListingCondition, ListingFilters as Filters } from "@/types";
import { Checkbox, Radio } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrency } from "@/lib/format";

const categories: ListingCategory[] = ["furniture", "electronics", "books", "plants", "other"];

const conditions: ListingCondition[] = ["new", "used-excellent", "used-good"];

const MAX_PRICE = 500;

export function ListingFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
  const { locale, t } = useI18n();
  const selectedCategories = filters.categories ?? [];
  const selectedConditions = filters.conditions ?? [];

  function toggleCategory(value: ListingCategory) {
    const next = selectedCategories.includes(value)
      ? selectedCategories.filter((c) => c !== value)
      : [...selectedCategories, value];
    onChange({ ...filters, categories: next });
  }

  function toggleCondition(value: ListingCondition) {
    const next = selectedConditions.includes(value)
      ? selectedConditions.filter((c) => c !== value)
      : [...selectedConditions, value];
    onChange({ ...filters, conditions: next });
  }

  return (
    <Card className="p-5 h-fit sticky top-20">
      <h2 className="font-bold text-ink mb-4">{t.filters.title}</h2>

      <div className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-2.5">{t.filters.category}</h3>
        <div className="flex flex-col gap-2">
          {categories.map((c) => (
            <Checkbox
              key={c}
              label={t.listing.category[c]}
              checked={selectedCategories.includes(c)}
              onChange={() => toggleCategory(c)}
            />
          ))}
        </div>
      </div>

      <div className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-2.5">{t.filters.priceRange}</h3>
        <div className="flex items-center gap-2 text-sm text-ink-600 mb-2">
          <span>{formatCurrency(filters.minPrice ?? 0, locale)}</span>
          <span className="text-ink-400">&ndash;</span>
          <span>{formatCurrency(filters.maxPrice ?? MAX_PRICE, locale)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={MAX_PRICE}
          step={5}
          value={filters.maxPrice ?? MAX_PRICE}
          onChange={(e) => onChange({ ...filters, maxPrice: Number(e.target.value) })}
          className="w-full accent-amber"
        />
      </div>

      <div className="mb-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-2.5">{t.filters.listingType}</h3>
        <div className="flex flex-col gap-2">
          <Radio
            label={t.filters.all}
            name="listing-type"
            checked={(filters.type ?? "all") === "all"}
            onChange={() => onChange({ ...filters, type: "all" })}
          />
          <Radio
            label={t.listing.directSale}
            name="listing-type"
            checked={filters.type === "direct"}
            onChange={() => onChange({ ...filters, type: "direct" })}
          />
          <Radio
            label={t.listing.auction}
            name="listing-type"
            checked={filters.type === "auction"}
            onChange={() => onChange({ ...filters, type: "auction" })}
          />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-2.5">{t.filters.condition}</h3>
        <div className="flex flex-col gap-2">
          {conditions.map((c) => (
            <Checkbox
              key={c}
              label={t.listing.condition[c]}
              checked={selectedConditions.includes(c)}
              onChange={() => toggleCondition(c)}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
