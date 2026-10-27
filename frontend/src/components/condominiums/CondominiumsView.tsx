"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import { addCondominium, fetchCondominiums, removeCondominium, type Condominium } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { useI18n } from "@/i18n/I18nProvider";

// Admins maintain the condominiums residents can pick at sign-up.
export function CondominiumsView() {
  const { t } = useI18n();
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
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
      const added = await addCondominium(name.trim());
      setCondominiums((prev) => [...prev, added].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
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

      <form onSubmit={handleAdd} className="mb-2 flex gap-2">
        <Input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.condominiums.name}
          aria-label={t.condominiums.name}
        />
        <Button type="submit" disabled={adding || !name.trim()} className="shrink-0">
          <Plus size={16} /> {adding ? t.condominiums.adding : t.condominiums.add}
        </Button>
      </form>
      {error && <p className="mb-2 text-sm font-medium text-danger">{error}</p>}

      {!loading &&
        (condominiums.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ink-400">{t.condominiums.empty}</p>
        ) : (
          <Card className="mt-4 divide-y divide-line">
            {condominiums.map((condominium) => (
              <div key={condominium.id} className="flex items-center gap-3 px-4 py-3">
                <Building2 size={18} className="shrink-0 text-ink-400" />
                <p className="min-w-0 flex-1 truncate font-semibold text-ink">{condominium.name}</p>
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
