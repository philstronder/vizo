"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Message } from "@/types";
import { formatRelativeTime } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Send } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/I18nProvider";

export function MessageThread({
  messages,
  onSend,
}: {
  messages: Message[];
  onSend: (body: string) => Promise<void>;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const { locale, t } = useI18n();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      await onSend(draft.trim());
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h3 className="mb-3 font-bold text-ink">{t.messages.title}</h3>
      <div className="mb-3 flex max-h-56 flex-col gap-2.5 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-ink-400">{t.messages.empty}</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className={`font-semibold ${m.role === "seller" ? "text-amber-600" : "text-ink"}`}>
              {m.role === "seller" ? t.common.seller : t.common.buyer} &middot; {m.authorName.split(" ")[0]}:
            </span>{" "}
            <span className="text-ink-600">&ldquo;{m.body}&rdquo;</span>{" "}
            <span className="text-xs text-ink-400">{formatRelativeTime(m.createdAt, locale)}</span>
          </div>
        ))}
      </div>
      {user ? (
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.messages.placeholder}
            disabled={sending}
            className="flex-1 rounded-lg border border-line-strong bg-paper px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-amber/60 focus:border-amber-500"
          />
          <Button type="submit" size="sm" disabled={sending}>
            <Send size={14} /> {t.messages.send}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-ink-400">
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="font-semibold text-amber-600 hover:underline">
            {t.messages.signIn}
          </Link>{" "}
          {t.messages.toAsk}
        </p>
      )}
    </div>
  );
}
