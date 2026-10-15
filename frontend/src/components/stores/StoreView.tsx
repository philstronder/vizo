"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, Plus, Store as StoreIcon, Trash2, Tv } from "lucide-react";
import { deleteStore, fetchListings, fetchStore, updateStore, type StorePayload } from "@/lib/api";
import type { Listing, Store } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { useConfineToStore, useStoreMode } from "@/lib/store-mode";
import { Button } from "@/components/ui/Button";
import { ListingCard } from "@/components/listings/ListingCard";
import { StoreFormModal } from "./StoreFormModal";
import { StoreQrCode } from "./StoreQrCode";
import { useI18n } from "@/i18n/I18nProvider";

export function StoreView({ storeId, purchased }: { storeId: string; purchased: boolean }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const inStoreMode = useStoreMode() === storeId;
  const isAdmin = !!user?.isAdmin;

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  useConfineToStore(store?.id);

  useEffect(() => {
    let active = true;
    // Admins also see sold/ended products so they can track the store.
    Promise.all([fetchStore(storeId), fetchListings({ storeId, status: isAdmin ? "all" : undefined })])
      .then(([storeData, rows]) => {
        if (!active) return;
        setStore(storeData);
        setProducts(rows);
      })
      .catch(() => {
        if (active) setNotFoundState(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [storeId, isAdmin]);

  async function handleUpdate(payload: StorePayload) {
    setStore(await updateStore(storeId, payload));
  }

  async function handleDelete() {
    if (!store || !confirm(t.store.confirmDelete(store.name))) return;
    setDeleteError(null);
    try {
      await deleteStore(storeId);
      router.push("/stores");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t.store.deleteError);
    }
  }

  if (loading) {
    return <div className="py-20 text-center text-sm text-ink-400">{t.store.loading}</div>;
  }

  if (notFoundState || !store) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="mb-2 text-xl font-bold text-ink">{t.store.notFoundTitle}</h1>
        <p className="mb-6 text-sm text-ink-400">{t.store.notFoundHint}</p>
        {isAdmin && !inStoreMode && <Button href="/stores">{t.store.allStores}</Button>}
      </div>
    );
  }

  const showAdminTools = isAdmin && !inStoreMode;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {purchased && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">
          <CheckCircle2 size={16} /> {t.store.purchased}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink text-amber">
            <Tv size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-black text-ink">{store.name}</h1>
            {store.description && <p className="mt-1 max-w-2xl text-sm text-ink-400">{store.description}</p>}
            {!user && <p className="mt-2 text-xs text-ink-400">{t.store.signInToBuy}</p>}
          </div>
        </div>
        {showAdminTools && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" href={`/sell/new?store=${store.id}`}>
              <Plus size={16} /> {t.store.addProduct}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil size={14} /> {t.store.edit}
            </Button>
            <Button size="sm" variant="danger" onClick={handleDelete}>
              <Trash2 size={14} /> {t.store.delete}
            </Button>
          </div>
        )}
      </div>
      {deleteError && <p className="mb-4 text-sm font-medium text-danger">{deleteError}</p>}

      <div className={showAdminTools ? "grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]" : ""}>
        {products.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 content-start">
            {products.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong py-20 text-center">
            <StoreIcon className="mb-2 text-ink-400" size={22} />
            <p className="text-sm text-ink-400">{t.store.empty}</p>
          </div>
        )}

        {showAdminTools && (
          <div className="order-first lg:order-none">
            <StoreQrCode storeId={store.id} storeName={store.name} />
          </div>
        )}
      </div>

      {showAdminTools && (
        <StoreFormModal open={editOpen} onClose={() => setEditOpen(false)} store={store} onSubmit={handleUpdate} />
      )}
    </div>
  );
}
