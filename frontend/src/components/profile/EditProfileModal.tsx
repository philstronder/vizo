"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { FieldGroup, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/i18n/I18nProvider";

export function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateProfile } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Re-seed the form from the latest saved user data whenever the modal
  // transitions from closed to open, so a cancel-and-reopen never shows a
  // stale, unsaved edit.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && user) {
      setName(user.name);
      setBuildingName(user.buildingName);
      setUnitNumber(user.unitNumber);
      setError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateProfile({ name: name.trim(), buildingName: buildingName.trim(), unitNumber: unitNumber.trim() });
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
        <FieldGroup label={t.profile.building}>
          <Input required value={buildingName} onChange={(e) => setBuildingName(e.target.value)} />
        </FieldGroup>
        <FieldGroup label={t.profile.unitNumber}>
          <Input required value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} />
        </FieldGroup>

        {error && <p className="mb-3 text-xs font-medium text-danger">{error}</p>}

        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? t.common.saving : t.profile.saveChanges}
        </Button>
      </form>
    </Modal>
  );
}
