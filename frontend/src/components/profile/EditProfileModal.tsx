"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { FieldGroup, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  DeliveryAddressFields,
  EMPTY_ADDRESS,
  isAddressComplete,
  trimAddress,
} from "@/components/account/DeliveryAddressFields";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/I18nProvider";

export function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateProfile } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // TV store viewer accounts edit their delivery details, and may join a
  // building community by filling in both building fields.
  const isViewer = !!user && !user.buildingName;

  // Re-seed the form from the latest saved user data whenever the modal
  // transitions from closed to open, so a cancel-and-reopen never shows a
  // stale, unsaved edit.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && user) {
      setName(user.name);
      setBuildingName(user.buildingName ?? "");
      setUnitNumber(user.unitNumber ?? "");
      setPhone(user.phone ?? "");
      setAddress(user.deliveryAddress ?? EMPTY_ADDRESS);
      setError(null);
    }
  }

  const joiningBuilding = isViewer && (buildingName.trim() !== "" || unitNumber.trim() !== "");
  const canSubmit = isViewer
    ? phone.trim().length >= 8 &&
      isAddressComplete(address) &&
      (!joiningBuilding || (buildingName.trim() !== "" && unitNumber.trim() !== ""))
    : true;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateProfile(
        isViewer
          ? {
              name: name.trim(),
              phone: phone.trim(),
              deliveryAddress: trimAddress(address),
              ...(joiningBuilding ? { buildingName: buildingName.trim(), unitNumber: unitNumber.trim() } : {}),
            }
          : { name: name.trim(), buildingName: buildingName.trim(), unitNumber: unitNumber.trim() }
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.profile.saveError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t.profile.editDetails}>
      <form onSubmit={handleSubmit}>
        <FieldGroup label={t.profile.name}>
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </FieldGroup>
        {isViewer ? (
          <>
            <FieldGroup label={t.address.phone}>
              <Input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t.address.phonePlaceholder}
              />
            </FieldGroup>
            <h3 className="mb-3 mt-5 text-sm font-bold text-ink">{t.address.deliveryAddress}</h3>
            <DeliveryAddressFields value={address} onChange={setAddress} />
            <h3 className="mt-5 text-sm font-bold text-ink">{t.profile.joinBuildingTitle}</h3>
            <p className="mb-3 text-xs text-ink-400">{t.profile.joinBuildingHint}</p>
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label={t.profile.building}>
                <Input value={buildingName} onChange={(e) => setBuildingName(e.target.value)} />
              </FieldGroup>
              <FieldGroup label={t.profile.unitNumber}>
                <Input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} />
              </FieldGroup>
            </div>
          </>
        ) : (
          <>
            <FieldGroup label={t.profile.building}>
              <Input required value={buildingName} onChange={(e) => setBuildingName(e.target.value)} />
            </FieldGroup>
            <FieldGroup label={t.profile.unitNumber}>
              <Input required value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} />
            </FieldGroup>
          </>
        )}

        {error && <p className="mb-3 text-xs font-medium text-danger">{error}</p>}

        <Button type="submit" fullWidth disabled={!canSubmit || submitting}>
          {submitting ? t.common.saving : t.profile.saveChanges}
        </Button>
      </form>
    </Modal>
  );
}
