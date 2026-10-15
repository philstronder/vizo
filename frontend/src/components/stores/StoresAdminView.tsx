"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Store as StoreIcon } from "lucide-react";
import { createStore, fetchStores } from "@/lib/api";
import type { Store } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { StoreFormModal } from "./StoreFormModal";
import { storeHref } from "@/lib/store-mode";
import { useI18n } from "@/i18n/I18nProvider";

export function StoresAdminView() {
  const { t } = useI18n();
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetchStores()
      .then((rows) => {
        if (active) setStores(rows);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleCreate(payload: { name: string; description: string }) {
    const store = await createStore(payload);
    router.push(storeHref(store.id));
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink">{t.store.adminTitle}</h1>
          <p className="mt-1 text-sm text-ink-400">{t.store.adminSubtitle}</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="shrink-0">
          <Plus size={16} /> {t.store.newStore}
        </Button>
      </div>

      {loading ? null : stores.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong py-20 text-center">
          <p className="font-semibold text-ink">{t.store.noStores}</p>
          <p className="mt-1 text-sm text-ink-400">{t.store.noStoresHint}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {stores.map((store) => (
            <Link key={store.id} href={storeHref(store.id)} className="block group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardBody className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink text-amber">
                    <StoreIcon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-ink line-clamp-1">{store.name}</p>
                    {store.description && (
                      <p className="text-sm text-ink-400 line-clamp-2">{store.description}</p>
                    )}
                    <p className="mt-1 text-xs text-ink-400">{t.store.productCount(store.productCount)}</p>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <StoreFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} />
    </div>
  );
}
