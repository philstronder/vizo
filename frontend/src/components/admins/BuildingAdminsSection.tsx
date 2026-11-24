"use client";

import { useEffect, useState } from "react";
import { Building2, Trash2, UserPlus } from "lucide-react";
import {
  addBuildingAdmin,
  fetchBuildingAdmins,
  fetchCondominiums,
  removeBuildingAdmin,
  type BuildingAdmin,
  type Condominium,
} from "@/lib/api";
import { CondominiumSelect } from "@/components/account/CondominiumSelect";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldGroup, Input } from "@/components/ui/Field";
import { useI18n } from "@/i18n/I18nProvider";
import { errorMessage } from "@/lib/error-message";

const byCondominiumThenName = (a: BuildingAdmin, b: BuildingAdmin) =>
  a.condominium.name.localeCompare(b.condominium.name) || a.user.name.localeCompare(b.user.name);

// Platform admins nominate building admins, who review the proofs of
// residency sent by people signing up to their condominium.
export function BuildingAdminsSection() {
  const { locale, t } = useI18n();
  const tb = t.buildingAdmins;
  const [rows, setRows] = useState<BuildingAdmin[]>([]);
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [condominiumName, setCondominiumName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchBuildingAdmins(), fetchCondominiums()])
      .then(([admins, condos]) => {
        if (!active) return;
        setRows(admins);
        setCondominiums(condos);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const condominium = condominiums.find((c) => c.name === condominiumName);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!condominium) return;
    setAdding(true);
    setError(null);
    try {
      const added = await addBuildingAdmin(email.trim(), condominium.id);
      setRows((prev) =>
        [
          ...prev.filter((r) => !(r.user.id === added.user.id && r.condominium.id === added.condominium.id)),
          added,
        ].sort(byCondominiumThenName)
      );
      setEmail("");
    } catch (err) {
      setError(errorMessage(err, t, locale, tb.addError));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(row: BuildingAdmin) {
    if (!confirm(tb.confirmRemove(row.user.name, row.condominium.name))) return;
    setError(null);
    try {
      await removeBuildingAdmin(row.condominium.id, row.user.id);
      setRows((prev) => prev.filter((r) => r !== row));
    } catch (err) {
      setError(errorMessage(err, t, locale, tb.removeError));
    }
  }

  return (
    <section className="mt-12">
      <h2 className="text-xl font-black text-ink">{tb.title}</h2>
      <p className="mt-1 mb-4 text-sm text-ink-400">{tb.subtitle}</p>

      <form onSubmit={handleAdd}>
        <FieldGroup label={tb.condominium}>
          <CondominiumSelect required value={condominiumName} onChange={setCondominiumName} />
        </FieldGroup>
        <div className="flex gap-2">
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.admins.email}
            aria-label={tb.email}
          />
          <Button type="submit" disabled={adding || !email.trim() || !condominium} className="shrink-0">
            <UserPlus size={16} /> {adding ? t.admins.adding : tb.add}
          </Button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm font-medium text-danger">{error}</p>}

      {!loading &&
        (rows.length === 0 ? (
          <p className="mt-4 text-sm text-ink-400">{tb.empty}</p>
        ) : (
          <Card className="mt-4 divide-y divide-line">
            {rows.map((row) => (
              <div key={`${row.condominium.id}:${row.user.id}`} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={row.user.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{row.user.name}</p>
                  <p className="truncate text-xs text-ink-400">{row.user.email}</p>
                </div>
                <Badge tone="info" className="hidden max-w-48 truncate sm:inline-flex">
                  <Building2 size={12} /> {row.condominium.name}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(row)}
                  aria-label={tb.removeFrom(row.user.name, row.condominium.name)}
                >
                  <Trash2 size={14} /> {t.admins.remove}
                </Button>
              </div>
            ))}
          </Card>
        ))}
    </section>
  );
}
