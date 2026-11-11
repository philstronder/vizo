"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Clock, Wallet as WalletIcon } from "lucide-react";
import { fetchWallet, withdrawCredits } from "@/lib/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FieldGroup, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { currencySymbol, formatCurrency, formatDate } from "@/lib/format";
import type { Wallet } from "@/types";
import { useI18n } from "@/i18n/I18nProvider";

export function WalletView() {
  const { locale, t } = useI18n();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchWallet().then(setWallet);
  }, []);

  if (!wallet) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-black text-ink">{t.wallet.title}</h1>
      <p className="mb-6 text-sm text-ink-400">{t.wallet.subtitle}</p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-600">
              <WalletIcon size={15} /> {t.wallet.balance}
            </p>
            <p className="my-2 text-3xl font-black text-ink">{formatCurrency(wallet.balance, locale)}</p>
            <Button size="sm" onClick={() => setWithdrawOpen(true)} disabled={wallet.balance <= 0}>
              {t.wallet.withdraw}
            </Button>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-600">
              <Clock size={15} /> {t.wallet.held}
            </p>
            <p className="my-2 text-3xl font-black text-ink-600">{formatCurrency(wallet.held, locale)}</p>
            <p className="text-xs text-ink-400">{t.wallet.heldHint}</p>
          </CardBody>
        </Card>
      </div>

      {notice && (
        <p className="mb-4 rounded-lg bg-success-bg px-3 py-2 text-sm font-medium text-success">{notice}</p>
      )}

      <Card>
        <CardBody>
          <h2 className="mb-2 font-bold text-ink">{t.wallet.history}</h2>
          {wallet.transactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">{t.wallet.noHistory}</p>
          ) : (
            <div className="divide-y divide-line">
              {wallet.transactions.map((tx) => {
                const incoming = tx.amount > 0;
                const Icon = incoming ? ArrowDownLeft : ArrowUpRight;
                return (
                  <div key={tx.id} className="flex items-center gap-3 py-3">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        incoming ? "bg-success-bg text-success" : "bg-cream-100 text-ink-600"
                      }`}
                    >
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{t.wallet.type[tx.type]}</p>
                      <p className="line-clamp-1 text-xs text-ink-400">
                        {tx.listingTitle ?? (tx.pixKey ? t.wallet.withdrawalTo(tx.pixKey) : "")}
                        {(tx.listingTitle || tx.pixKey) && " · "}
                        {formatDate(tx.createdAt, locale)}
                      </p>
                    </div>
                    <p className={`text-sm font-bold ${incoming ? "text-success" : "text-ink"}`}>
                      {incoming ? "+" : "−"}
                      {formatCurrency(Math.abs(tx.amount), locale)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <WithdrawModal
        open={withdrawOpen}
        balance={wallet.balance}
        onClose={() => setWithdrawOpen(false)}
        onWithdrawn={(updated, amount) => {
          setWallet(updated);
          setNotice(t.wallet.withdrawn(formatCurrency(amount, locale)));
          setWithdrawOpen(false);
        }}
      />
    </div>
  );
}

function WithdrawModal({
  open,
  balance,
  onClose,
  onWithdrawn,
}: {
  open: boolean;
  balance: number;
  onClose: () => void;
  onWithdrawn: (wallet: Wallet, amount: number) => void;
}) {
  const { locale, t } = useI18n();
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount.replace(",", "."));
    setSubmitting(true);
    setError(null);
    try {
      onWithdrawn(await withdrawCredits(value, pixKey.trim()), value);
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.wallet.withdrawError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t.wallet.withdrawTitle}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-sm text-ink-600">
          {t.wallet.balance}: <span className="font-bold text-ink">{formatCurrency(balance, locale)}</span>
        </p>
        <FieldGroup label={`${t.wallet.amount} (${currencySymbol(locale)})`} htmlFor="withdraw-amount">
          <div className="flex gap-2">
            <Input
              id="withdraw-amount"
              required
              type="number"
              inputMode="decimal"
              min="0.01"
              max={balance}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={() => setAmount(String(balance))}>
              {t.wallet.withdrawAll}
            </Button>
          </div>
        </FieldGroup>
        <FieldGroup label={t.wallet.pixKey} htmlFor="withdraw-pix">
          <Input
            id="withdraw-pix"
            required
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder={t.wallet.pixKeyPlaceholder}
          />
        </FieldGroup>
        {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? t.wallet.withdrawing : t.wallet.withdraw}
        </Button>
      </form>
    </Modal>
  );
}
