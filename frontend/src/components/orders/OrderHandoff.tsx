"use client";

import { useState } from "react";
import { CalendarClock, CircleCheck, Clock, ShieldCheck, Undo2, X } from "lucide-react";
import { acceptMeetup, cancelOrder, proposeMeetup } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { formatDateTime, toDateTimeLocalValue } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Order, OrderStatus } from "@/types";
import { useI18n } from "@/i18n/I18nProvider";
import { errorMessage } from "@/lib/error-message";
import { RateOrderModal } from "./RateOrderModal";

const openStatuses: OrderStatus[] = ["pending_pickup", "ready_for_pickup", "shipped"];

// A community sale's handoff: the payment the platform holds, the meetup the
// two neighbors agree on, and each side's confirmation of the handoff. The
// order completes (and the seller gets paid) once both have confirmed. Each
// side has to rate the other to confirm.
export function OrderHandoff({
  order,
  role,
  onUpdated,
}: {
  order: Order;
  role: "buyer" | "seller";
  onUpdated: (order: Order) => void;
}) {
  const { locale, t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);
  const [newMeetupAt, setNewMeetupAt] = useState("");
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [rating, setRating] = useState(false);

  const isOpen = openStatuses.includes(order.status);
  const otherName = role === "buyer" ? order.sellerName : order.buyerName;
  const iConfirmed = role === "buyer" ? order.buyerConfirmedDelivery : order.sellerConfirmedDelivery;
  const otherConfirmed = role === "buyer" ? order.sellerConfirmedDelivery : order.buyerConfirmedDelivery;
  const anyConfirmed = order.buyerConfirmedDelivery || order.sellerConfirmedDelivery;
  const proposedByMe = order.meetupProposedBy === role;
  // The other side suggested a time and it's on this user to confirm it.
  const awaitingMyConfirmation = isOpen && !!order.meetupAt && !order.meetupConfirmed && !proposedByMe;
  // Mirrors the backend: the handoff can't be confirmed before the time is agreed.
  const handoffLocked = !!order.meetupAt && !order.meetupConfirmed;
  // Mirrors the backend: the buyer can only back out until the meetup is agreed.
  const canCancel = isOpen && !anyConfirmed && (role === "seller" || !order.meetupConfirmed);

  async function run(action: () => Promise<Order>) {
    setBusy(true);
    setError(null);
    try {
      onUpdated(await action());
      setProposing(false);
      setConfirmingCancel(false);
    } catch (err) {
      setError(errorMessage(err, t, locale, t.orders.updateError));
    } finally {
      setBusy(false);
    }
  }

  function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    run(() => proposeMeetup(order.id, new Date(newMeetupAt).toISOString()));
  }

  const place = order.pickupLocation
    ? (t.checkout.pickupOptions as Record<string, string>)[order.pickupLocation] ?? order.pickupLocation
    : undefined;

  return (
    <div className="mt-2 space-y-2">
      {order.paymentStatus && (
        <p
          className={cn(
            "flex items-start gap-1.5 text-xs",
            order.paymentStatus === "held" ? "text-ink-600" : "text-ink-400",
          )}
        >
          {order.paymentStatus === "refunded" ? (
            <Undo2 size={13} className="mt-px shrink-0" />
          ) : (
            <ShieldCheck size={13} className="mt-px shrink-0 text-success" />
          )}
          <span>
            <span className="font-semibold">{t.orders.payment[order.paymentStatus]}</span>
            {order.paymentStatus === "held" && (
              <> &middot; {role === "buyer" ? t.orders.heldHintBuyer : t.orders.heldHintSeller}</>
            )}
          </span>
        </p>
      )}

      {isOpen && order.meetupAt && (
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-xs text-ink-600",
            awaitingMyConfirmation ? "border border-amber-500/60 bg-amber-100/60" : "bg-cream-100",
          )}
        >
          {awaitingMyConfirmation && (
            <p className="mb-1.5 font-semibold text-ink">{t.orders.confirmMeetupPrompt(otherName)}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="flex min-w-0 flex-1 items-start gap-1.5">
              <CalendarClock size={13} className="mt-px shrink-0" />
              <span>
                <span className="font-semibold">{t.orders.meetup}:</span>{" "}
                {t.orders.meetupAt(formatDateTime(order.meetupAt, locale), place)}
                <br />
                <span className={order.meetupConfirmed ? "font-semibold text-success" : "text-ink-400"}>
                  {order.meetupConfirmed
                    ? t.orders.meetupConfirmed
                    : proposedByMe
                      ? t.orders.meetupWaitingOther(otherName)
                      : t.orders.meetupProposedBy(otherName)}
                </span>
              </span>
            </p>
            {!anyConfirmed && !proposing && (
              <div className="flex gap-2">
                {!order.meetupConfirmed && !proposedByMe && (
                  <Button size="sm" onClick={() => run(() => acceptMeetup(order.id))} disabled={busy}>
                    {t.orders.acceptMeetup}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setNewMeetupAt("");
                    setProposing(true);
                  }}
                  disabled={busy}
                >
                  {t.orders.suggestAnother}
                </Button>
              </div>
            )}
          </div>
          {proposing && (
            <form onSubmit={handlePropose} className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                type="datetime-local"
                required
                aria-label={t.orders.newMeetupTime}
                min={toDateTimeLocalValue(new Date())}
                value={newMeetupAt}
                onChange={(e) => setNewMeetupAt(e.target.value)}
                className="w-auto flex-1 py-1.5"
              />
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? t.common.saving : t.orders.proposeMeetup}
              </Button>
              <button
                type="button"
                onClick={() => setProposing(false)}
                className="rounded-full p-1.5 text-ink-400 hover:bg-cream hover:text-ink"
                aria-label={t.common.close}
              >
                <X size={14} />
              </button>
            </form>
          )}
        </div>
      )}

      {isOpen && otherConfirmed && !iConfirmed && (
        <p className="rounded-lg bg-amber-100/60 px-3 py-2 text-xs font-medium text-ink">
          {t.orders.otherConfirmed(otherName)}
        </p>
      )}

      {isOpen && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {error && <p className="mr-auto text-xs text-danger">{error}</p>}
          {confirmingCancel ? (
            <>
              <p className="mr-auto text-xs text-ink-600">{t.orders.confirmCancel}</p>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingCancel(false)} disabled={busy}>
                {t.orders.keepOrder}
              </Button>
              <Button variant="danger" size="sm" onClick={() => run(() => cancelOrder(order.id))} disabled={busy}>
                {busy ? t.orders.cancelling : t.orders.cancelOrder}
              </Button>
            </>
          ) : (
            <>
              {canCancel && (
                <Button variant="ghost" size="sm" onClick={() => setConfirmingCancel(true)} disabled={busy}>
                  {t.orders.cancelOrder}
                </Button>
              )}
              {handoffLocked ? (
                <p className="text-xs text-ink-400">{t.orders.handoffAfterMeetup}</p>
              ) : iConfirmed ? (
                <p className="flex items-center gap-1.5 text-xs text-ink-400">
                  <Clock size={13} /> {t.orders.youConfirmed} &middot; {t.orders.waitingForConfirmation(otherName)}
                </p>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={() => setRating(true)} disabled={busy}>
                    <CircleCheck size={14} /> {role === "buyer" ? t.orders.confirmReceived : t.orders.confirmHandedOver}
                  </Button>
                  <RateOrderModal
                    order={order}
                    target={role === "buyer" ? "seller" : "buyer"}
                    open={rating}
                    onClose={() => setRating(false)}
                    onRated={onUpdated}
                    confirmsHandoff
                  />
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
