"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { fetchOrderMessages, sendOrderMessage } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Order, OrderMessage } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/I18nProvider";
import { errorMessage } from "@/lib/error-message";

// How often an open chat checks for new messages.
const POLL_MS = 5000;

// Private conversation between an order's buyer and seller.
export function OrderChat({
  order,
  role,
  open,
  onClose,
  onRead,
}: {
  order: Order;
  role: "buyer" | "seller";
  open: boolean;
  onClose: () => void;
  onRead: () => void; // opening the chat marks the other side's messages read
}) {
  const { user } = useAuth();
  const { locale, t } = useI18n();
  const [messages, setMessages] = useState<OrderMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const otherName = role === "buyer" ? order.sellerName : order.buyerName;
  const closed = order.status === "cancelled";

  // A ref, so a new onRead from the parent doesn't restart polling.
  const onReadRef = useRef(onRead);
  useEffect(() => {
    onReadRef.current = onRead;
  }, [onRead]);
  const loadError = t.orderChat.loadError;

  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = () =>
      fetchOrderMessages(order.id)
        .then((loaded) => {
          if (!active) return;
          setMessages(loaded);
          onReadRef.current();
        })
        .catch(() => active && setError(loadError));
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [open, order.id, loadError]);

  // Keep the newest message in view.
  const count = messages?.length ?? 0;
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [count]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      const sent = await sendOrderMessage(order.id, body);
      setMessages((prev) => [...(prev ?? []), sent]);
      setDraft("");
    } catch (err) {
      setError(errorMessage(err, t, locale, t.orderChat.sendError));
    } finally {
      setSending(false);
    }
  }

  const lastMine = messages?.findLast((m) => m.authorId === user?.id);

  return (
    <Modal open={open} onClose={onClose} title={t.orderChat.title(otherName)} wide>
      <p className="-mt-2 mb-3 text-xs text-ink-400">{t.orderChat.subtitle(order.listingTitle)}</p>
      <div
        ref={listRef}
        className="mb-3 flex h-80 flex-col gap-2 overflow-y-auto rounded-xl bg-cream-100 p-3"
        aria-live="polite"
      >
        {messages?.length === 0 && (
          <p className="m-auto max-w-56 text-center text-sm text-ink-400">{t.orderChat.empty}</p>
        )}
        {messages?.map((m) => {
          const mine = m.authorId === user?.id;
          return (
            <div key={m.id} className={cn("flex max-w-[80%] flex-col", mine ? "items-end self-end" : "items-start self-start")}>
              <p
                className={cn(
                  "whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                  mine ? "rounded-br-sm bg-amber text-ink" : "rounded-bl-sm bg-paper text-ink",
                )}
              >
                {m.body}
              </p>
              <span className="mt-0.5 px-1 text-[11px] text-ink-400">
                {formatRelativeTime(m.createdAt, locale)}
                {m === lastMine && m.read && <> &middot; {t.orderChat.seen}</>}
              </span>
            </div>
          );
        })}
      </div>
      {error && <p className="mb-2 text-xs font-medium text-danger">{error}</p>}
      {closed ? (
        <p className="text-sm text-ink-400">{t.orderChat.closed}</p>
      ) : (
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.orderChat.placeholder}
            maxLength={2000}
            disabled={sending}
            autoFocus
            className="flex-1 rounded-lg border border-line-strong bg-paper px-3.5 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber/60"
          />
          <Button type="submit" size="sm" disabled={sending || !draft.trim()}>
            <Send size={14} /> {t.orderChat.send}
          </Button>
        </form>
      )}
    </Modal>
  );
}
