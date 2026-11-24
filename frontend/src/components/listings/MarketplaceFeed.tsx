"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchListings } from "@/lib/api";
import type { Listing, ListingFilters as Filters } from "@/types";
import { ListingFilters } from "./ListingFilters";
import { ListingCard } from "./ListingCard";
import { Select } from "@/components/ui/Field";
import { SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

export function MarketplaceFeed() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const query = searchParams.get("q") ?? "";
  const [filters, setFilters] = useState<Filters>({ type: "all" });
  const [sort, setSort] = useState<"newest" | "price-asc" | "price-desc">("newest");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetchListings({ status: "active" })
      .then((rows) => {
        if (active) setListings(rows);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const results = useMemo(() => {
    let items = listings;

    if (query) {
      const q = query.toLowerCase();
      items = items.filter(
        (l) => l.title.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)
      );
    }
    if (filters.categories?.length) {
      items = items.filter((l) => filters.categories!.includes(l.category));
    }
    if (filters.conditions?.length) {
      items = items.filter((l) => filters.conditions!.includes(l.condition));
    }
    if (filters.type && filters.type !== "all") {
      items = items.filter((l) => l.type === filters.type);
    }
    const priceOf = (l: (typeof items)[number]) => l.price ?? l.currentBid ?? l.startingPrice ?? 0;
    const { minPrice, maxPrice } = filters;
    if (minPrice !== undefined) items = items.filter((l) => priceOf(l) >= minPrice);
    if (maxPrice !== undefined) items = items.filter((l) => priceOf(l) <= maxPrice);

    if (sort === "price-asc") items = [...items].sort((a, b) => priceOf(a) - priceOf(b));
    if (sort === "price-desc") items = [...items].sort((a, b) => priceOf(b) - priceOf(a));
    if (sort === "newest")
      items = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return items;
  }, [query, filters, sort, listings]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-ink">{t.feed.title}</h1>
          <p className="text-sm text-ink-400">
            {t.feed.count(results.length)}
            {query && t.feed.matching(query)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="lg:hidden inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-paper px-3 py-2 text-sm font-medium text-ink-600"
            onClick={() => setMobileFiltersOpen((v) => !v)}
          >
            <SlidersHorizontal size={15} /> {t.feed.filters}
          </button>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="w-auto"
          >
            <option value="newest">{t.feed.sortNewest}</option>
            <option value="price-asc">{t.feed.sortPriceAsc}</option>
            <option value="price-desc">{t.feed.sortPriceDesc}</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <div className={mobileFiltersOpen ? "block" : "hidden lg:block"}>
          <ListingFilters filters={filters} onChange={setFilters} />
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-ink-400">{t.feed.loading}</div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 content-start">
            {results.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong py-20 text-center">
            <p className="font-semibold text-ink">{t.feed.emptyTitle}</p>
            <p className="text-sm text-ink-400 mt-1">{t.feed.emptyHint}</p>
          </div>
        )}
      </div>
    </div>
  );
}
