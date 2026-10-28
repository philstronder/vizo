"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import { addCondominium, fetchCondominiums, removeCondominium, type Condominium } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldGroup, Input } from "@/components/ui/Field";
import {
  DeliveryAddressFields,
  EMPTY_ADDRESS,
  formatAddress,
  isAddressComplete,
  trimAddress,
} from "@/components/account/DeliveryAddressFields";
import { useI18n } from "@/i18n/I18nProvider";

// Admins maintain the condominiums residents can pick at sign-up.
export function CondominiumsView() {
  const { t } = useI18n();
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchCondominiums()
      .then((rows) => {
        if (active) setCondominiums(rows);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const added = await addCondominium(name.trim(), trimAddress(address));
      setCondominiums((prev) => [...prev, added].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setAddress(EMPTY_ADDRESS);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.condominiums.addError);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(condominium: Condominium) {
    if (!confirm(t.condominiums.confirmRemove(condominium.name))) return;
    setError(null);
    try {
      await removeCondominium(condominium.id);
      setCondominiums((prev) => prev.filter((c) => c.id !== condominium.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.condominiums.removeError);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-black text-ink">{t.condominiums.title}</h1>
      <p className="mt-1 mb-6 text-sm text-ink-400">{t.condominiums.subtitle}</p>

      <Card className="mb-2 p-4">
        <form onSubmit={handleAdd}>
          <FieldGroup label={t.condominiums.name}>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </FieldGroup>
          <DeliveryAddressFields value={address} onChange={setAddress} withComplement={false} />
          {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}
          <Button type="submit" disabled={adding || !name.trim() || !isAddressComplete(address)}>
            <Plus size={16} /> {adding ? t.condominiums.adding : t.condominiums.add}
          </Button>
        </form>
      </Card>

      {!loading &&
        (condominiums.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ink-400">{t.condominiums.empty}</p>
        ) : (
          <Card className="mt-4 divide-y divide-line">
            {condominiums.map((condominium) => (
              <div key={condominium.id} className="flex items-center gap-3 px-4 py-3">
                <Building2 size={18} className="shrink-0 text-ink-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{condominium.name}</p>
                  {condominium.address && (
                    <p className="truncate text-sm text-ink-400">{formatAddress(condominium.address)}</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRemove(condominium)}>
                  <Trash2 size={14} /> {t.condominiums.remove}
                </Button>
              </div>
            ))}
          </Card>
        ))}
    </div>
  );
}
