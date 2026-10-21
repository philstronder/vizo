"use client";

import { ShoppingCart, Tv, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { useI18n } from "@/i18n/I18nProvider";

// What TV store viewer accounts (no building) see instead of community pages.
export function ViewerHome() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <Card>
        <CardBody className="text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-ink text-amber">
            <Tv size={22} />
          </span>
          <h1 className="mb-2 text-xl font-black text-ink">{t.viewer.title}</h1>
          <p className="mb-6 text-sm text-ink-400">{t.viewer.hint}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button href="/orders">
              <ShoppingCart size={16} /> {t.viewer.myOrders}
            </Button>
            <Button href="/profile" variant="secondary">
              <UserRound size={16} /> {t.viewer.profile}
            </Button>
          </div>
          <p className="mt-6 text-xs text-ink-400">{t.viewer.joinBuilding}</p>
        </CardBody>
      </Card>
    </div>
  );
}
