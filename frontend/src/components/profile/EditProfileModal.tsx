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
import { CondominiumSelect } from "@/components/account/CondominiumSelect";
import { ProofOfResidencyField } from "@/components/account/ProofOfResidencyField";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/I18nProvider";
import { errorMessage } from "@/lib/error-message";

export function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateProfile } = useAuth();
  const { locale, t } = useI18n();
  const [name, setName] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [buildingBlock, setBuildingBlock] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);
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
      setBuildingBlock(user.buildingBlock ?? "");
      setPhone(user.phone ?? "");
      setAddress(user.deliveryAddress ?? EMPTY_ADDRESS);
      setProofPhoto(null);
      setError(null);
    }
  }

  const joiningBuilding = isViewer && (buildingName.trim() !== "" || unitNumber.trim() !== "");
  // Joining or moving to another building needs a new proof of residency,
  // reviewed by that building's admins. Matched like the server does.
  const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const changingBuilding =
    buildingName.trim() !== "" && !(user?.buildingName && sameName(user.buildingName, buildingName));
  const canSubmit =
    (isViewer
      ? phone.trim().length >= 8 &&
        isAddressComplete(address) &&
        (!joiningBuilding || (buildingName.trim() !== "" && unitNumber.trim() !== ""))
      : true) &&
    (!changingBuilding || !!proofPhoto);

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
              ...(joiningBuilding
                ? { buildingName: buildingName.trim(), unitNumber: unitNumber.trim(), buildingBlock: buildingBlock.trim() }
                : {}),
              ...(changingBuilding && proofPhoto ? { proofPhoto } : {}),
            }
          : {
              name: name.trim(),
              buildingName: buildingName.trim(),
              unitNumber: unitNumber.trim(),
              buildingBlock: buildingBlock.trim(),
              ...(changingBuilding && proofPhoto ? { proofPhoto } : {}),
            }
      );
      onClose();
    } catch (err) {
      setError(errorMessage(err, t, locale, t.profile.saveError));
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
            <FieldGroup label={t.profile.building}>
              <CondominiumSelect value={buildingName} onChange={setBuildingName} />
            </FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label={t.auth.register.buildingBlock}>
                <Input value={buildingBlock} onChange={(e) => setBuildingBlock(e.target.value)} placeholder="A" />
              </FieldGroup>
              <FieldGroup label={t.profile.unitNumber}>
                <Input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} />
              </FieldGroup>
            </div>
          </>
        ) : (
          <>
            <FieldGroup label={t.profile.building}>
              <CondominiumSelect required value={buildingName} onChange={setBuildingName} />
            </FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label={t.auth.register.buildingBlock}>
                <Input value={buildingBlock} onChange={(e) => setBuildingBlock(e.target.value)} placeholder="A" />
              </FieldGroup>
              <FieldGroup label={t.profile.unitNumber}>
                <Input required value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} />
              </FieldGroup>
            </div>
          </>
        )}

        {changingBuilding && (
          <>
            <p className="mt-2 text-xs text-ink-400">{t.residency.changingBuildingHint}</p>
            <ProofOfResidencyField buildingName={buildingName.trim()} value={proofPhoto} onChange={setProofPhoto} />
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
