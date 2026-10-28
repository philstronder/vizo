"use client";

import { useRef, useState } from "react";
import { FieldGroup, Input } from "@/components/ui/Field";
import { ApiError, lookupCep } from "@/lib/api";
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
  withComplement = true,
}: {
  value: DeliveryAddress;
  // A state setter: the CEP lookup resolves after the user may have kept
  // typing, so it merges into the latest address with an updater.
  onChange: React.Dispatch<React.SetStateAction<DeliveryAddress>>;
  // A condominium's address has no complement; a delivery's has the unit.
  withComplement?: boolean;
}) {
  const { t } = useI18n();
  const set = (field: keyof DeliveryAddress) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [field]: e.target.value });

  const [cepStatus, setCepStatus] = useState<"idle" | "loading" | "notFound" | "failed">("idle");
  // Ignores a lookup answered after the CEP was changed again.
  const lastLookup = useRef("");

  function handlePostalCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    set("postalCode")(e);
    const cep = e.target.value.replace(/\D/g, "");
    if (cep.length !== 8) {
      lastLookup.current = "";
      setCepStatus("idle");
      return;
    }
    if (cep === lastLookup.current) return;
    lastLookup.current = cep;
    setCepStatus("loading");
    lookupCep(cep)
      .then((found) => {
        if (lastLookup.current !== cep) return;
        setCepStatus("idle");
        // Blank fields from ViaCEP (towns with a single CEP) keep what was typed.
        onChange((current) => ({
          ...current,
          postalCode: found.postalCode,
          street: found.street || current.street,
          district: found.district || current.district,
          city: found.city,
          state: found.state,
        }));
      })
      .catch((err) => {
        if (lastLookup.current !== cep) return;
        setCepStatus(err instanceof ApiError && err.status === 404 ? "notFound" : "failed");
      });
  }

  const cepHint = {
    idle: undefined,
    loading: t.address.cepLookingUp,
    notFound: t.address.cepNotFound,
    failed: t.address.cepLookupFailed,
  }[cepStatus];

  return (
    <>
      <div className="grid grid-cols-[2fr_1fr] gap-4">
        <FieldGroup label={t.address.postalCode} hint={cepHint}>
          <Input required inputMode="numeric" value={value.postalCode} onChange={handlePostalCodeChange} placeholder="01000-000" />
        </FieldGroup>
        <FieldGroup label={t.address.state}>
          <Input required value={value.state} onChange={set("state")} placeholder="SP" />
        </FieldGroup>
      </div>
      {withComplement ? (
        <>
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
        </>
      ) : (
        <div className="grid grid-cols-[3fr_1fr] gap-4">
          <FieldGroup label={t.address.street}>
            <Input required value={value.street} onChange={set("street")} />
          </FieldGroup>
          <FieldGroup label={t.address.number}>
            <Input required value={value.number} onChange={set("number")} />
          </FieldGroup>
        </div>
      )}
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
