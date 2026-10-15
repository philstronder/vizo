"use client";

import { useEffect, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { addAdmin, fetchAdmins, removeAdmin, type AuthUser } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { useI18n } from "@/i18n/I18nProvider";

export function AdminsView() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAdmins()
      .then((rows) => {
        if (active) setAdmins(rows);
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
      const added = await addAdmin(email.trim());
      setAdmins((prev) =>
        [...prev.filter((a) => a.id !== added.id), added].sort((a, b) => a.name.localeCompare(b.name))
      );
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.admins.addError);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(admin: AuthUser) {
    if (!confirm(t.admins.confirmRemove(admin.name))) return;
    setError(null);
    try {
      await removeAdmin(admin.id);
      setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.admins.removeError);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-black text-ink">{t.admins.title}</h1>
      <p className="mt-1 mb-6 text-sm text-ink-400">{t.admins.subtitle}</p>

      <form onSubmit={handleAdd} className="mb-2 flex gap-2">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.admins.email}
          aria-label={t.admins.email}
        />
        <Button type="submit" disabled={adding || !email.trim()} className="shrink-0">
          <UserPlus size={16} /> {adding ? t.admins.adding : t.admins.add}
        </Button>
      </form>
      {error && <p className="mb-2 text-sm font-medium text-danger">{error}</p>}

      {!loading && (
        <Card className="mt-4 divide-y divide-line">
          {admins.map((admin) => (
            <div key={admin.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={admin.name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold text-ink">
                  <span className="truncate">{admin.name}</span>
                  {admin.id === user?.id && <Badge tone="neutral">{t.admins.you}</Badge>}
                </p>
                <p className="truncate text-xs text-ink-400">{admin.email}</p>
              </div>
              {admin.id !== user?.id && (
                <Button variant="ghost" size="sm" onClick={() => handleRemove(admin)}>
                  <Trash2 size={14} /> {t.admins.remove}
                </Button>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
