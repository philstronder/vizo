"use client";

import { FieldGroup, Input } from "@/components/ui/Field";
import type { DeliveryAddress } from "@/types";
import { useI18n } from "@/i18n/I18nProvider";

export const EMPTY_ADDRESS: DeliveryAddress = {
  postalCode: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
};

export function isAddressComplete(address: DeliveryAddress) {
  const required = [address.postalCode, address.street, address.number, address.district, address.city, address.state];
  return required.every((v) => v.trim().length > 0);
}

export function trimAddress(address: DeliveryAddress): DeliveryAddress {
  return {
    postalCode: address.postalCode.trim(),
    street: address.street.trim(),
    number: address.number.trim(),
    complement: address.complement?.trim() || undefined,
    district: address.district.trim(),
    city: address.city.trim(),
    state: address.state.trim(),
  };
}

// "Rua das Flores, 120 - Apto 4, Centro, São Paulo - SP, 01000-000"
export function formatAddress(a: DeliveryAddress) {
  const street = `${a.street}, ${a.number}${a.complement ? ` - ${a.complement}` : ""}`;
  return `${street}, ${a.district}, ${a.city} - ${a.state}, ${a.postalCode}`;
}

export function DeliveryAddressFields({
  value,
  onChange,
}: {
  value: DeliveryAddress;
  onChange: (address: DeliveryAddress) => void;
}) {
  const { t } = useI18n();
  const set = (field: keyof DeliveryAddress) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [field]: e.target.value });

  return (
    <>
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <FieldGroup label={t.address.postalCode}>
          <Input required inputMode="numeric" value={value.postalCode} onChange={set("postalCode")} placeholder="01000-000" />
        </FieldGroup>
        <FieldGroup label={t.address.state}>
          <Input required value={value.state} onChange={set("state")} placeholder="SP" />
        </FieldGroup>
      </div>
      <FieldGroup label={t.address.street}>
        <Input required value={value.street} onChange={set("street")} />
      </FieldGroup>
      <div className="grid grid-cols-[1fr_2fr] gap-4">
        <FieldGroup label={t.address.number}>
          <Input required value={value.number} onChange={set("number")} />
        </FieldGroup>
        <FieldGroup label={t.address.complement}>
          <Input value={value.complement ?? ""} onChange={set("complement")} placeholder={t.address.complementPlaceholder} />
        </FieldGroup>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FieldGroup label={t.address.district}>
          <Input required value={value.district} onChange={set("district")} />
        </FieldGroup>
        <FieldGroup label={t.address.city}>
          <Input required value={value.city} onChange={set("city")} />
        </FieldGroup>
      </div>
    </>
  );
}
