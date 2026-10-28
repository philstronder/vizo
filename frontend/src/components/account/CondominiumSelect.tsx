"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/ui/Field";
import { fetchCondominiums, type Condominium } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";

// The condominiums admins maintain. A resident whose condominium was since
// removed from the list still sees it selected, so saving their profile
// doesn't move them out of their community.
// With onCreateNew, a last option lets the user add a condominium that's
// missing from the list.
const CREATE_NEW = "__create_new__";

export function CondominiumSelect({
  value,
  onChange,
  onCreateNew,
  required,
}: {
  value: string;
  onChange: (name: string) => void;
  onCreateNew?: () => void;
  required?: boolean;
}) {
  const { t } = useI18n();
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);

  useEffect(() => {
    let active = true;
    fetchCondominiums()
      .then((rows) => {
        if (active) setCondominiums(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const names = condominiums.map((c) => c.name);
  if (value && !names.some((n) => n.trim().toLowerCase() === value.trim().toLowerCase())) names.unshift(value);

  return (
    <Select
      required={required}
      value={value}
      onChange={(e) => (e.target.value === CREATE_NEW ? onCreateNew?.() : onChange(e.target.value))}
    >
      <option value="" disabled={required}>
        {t.auth.register.buildingPlaceholder}
      </option>
      {names.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
      {onCreateNew && <option value={CREATE_NEW}>{t.auth.register.addCondominium}</option>}
    </Select>
  );
}
