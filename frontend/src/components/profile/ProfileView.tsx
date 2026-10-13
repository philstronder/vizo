"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { deleteListing, fetchListings } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { PlaceholderImage } from "@/components/listings/PlaceholderImage";
import { EditProfileModal } from "./EditProfileModal";
import { formatCurrency, formatDate } from "@/lib/format";
import { BadgeCheck, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import type { Listing } from "@/types";
import { useI18n } from "@/i18n/I18nProvider";

const statusTone: Record<Listing["status"], "success" | "danger" | "neutral"> = {
  active: "success",
  sold: "danger",
  ended: "neutral",
  draft: "neutral",
};

export function ProfileView() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const load = useCallback(() => {
    if (!user) return Promise.resolve();
    return fetchListings({ sellerId: user.id }).then((rows) => {
      setMyListings(rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(listing: Listing) {
    if (!confirm(t.profile.confirmDelete(listing.title))) return;
    await deleteListing(listing.id);
    setMyListings((prev) => prev.filter((l) => l.id !== listing.id));
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Card className="mb-8">
        <CardBody className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Avatar name={user.name} size={64} />
          <div className="flex-1">
            <p className="flex items-center gap-1.5 text-lg font-bold text-ink">
              {user.name}
              {user.verified && <BadgeCheck size={17} className="text-info" />}
            </p>
            <p className="text-sm text-ink-400">
              {t.common.unit(user.unitNumber)} &middot; {user.buildingName} &middot;{" "}
              {t.common.memberSince(formatDate(user.memberSince, locale))}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setEditModalOpen(true)}>
            <Pencil size={14} /> {t.profile.editDetails}
          </Button>
        </CardBody>
      </Card>

      <EditProfileModal open={editModalOpen} onClose={() => setEditModalOpen(false)} />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-black text-ink">{t.profile.myListings}</h1>
        <Button href="/sell/new" size="sm">
          <Plus size={16} /> {t.profile.addItem}
        </Button>
      </div>

      {loading ? (
        <p className="py-14 text-center text-sm text-ink-400">{t.profile.loading}</p>
      ) : myListings.length === 0 ? (
        <Card>
          <CardBody className="py-14 text-center">
            <p className="font-semibold text-ink">{t.profile.emptyTitle}</p>
            <p className="mb-4 text-sm text-ink-400">{t.profile.emptyHint}</p>
            <Button href="/sell/new">
              <Plus size={16} /> {t.profile.listFirst}
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {myListings.map((listing) => {
            const priceLabel =
              listing.type === "auction"
                ? t.profile.currentBid(formatCurrency(listing.currentBid ?? listing.startingPrice ?? 0, locale))
                : formatCurrency(listing.price ?? 0, locale);
            return (
              <Card key={listing.id} className="overflow-hidden">
                <Link href={`/listing/${listing.id}`}>
                  <PlaceholderImage
                    seed={listing.images[0] ?? listing.id}
                    category={listing.category}
                    className="aspect-square w-full"
                  />
                </Link>
                <CardBody className="p-3">
                  <p className="mb-1 line-clamp-1 text-sm font-semibold text-ink">{listing.title}</p>
                  <p className="mb-2 text-xs text-ink-400">{priceLabel}</p>
                  <Badge tone={statusTone[listing.status]} className="mb-3">
                    {t.listing.status[listing.status]}
                  </Badge>
                  <div className="flex items-center gap-3 text-xs font-medium">
                    <Link href={`/listing/${listing.id}`} className="text-ink-600 hover:text-ink">
                      {listing.type === "auction" ? t.profile.viewBids : t.profile.edit}
                    </Link>
                    <button
                      onClick={() => handleDelete(listing)}
                      className="ml-auto flex items-center gap-1 text-danger hover:opacity-80"
                    >
                      <Trash2 size={12} /> {t.profile.delete}
                    </button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
