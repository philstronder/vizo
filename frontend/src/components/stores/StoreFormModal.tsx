"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { FieldGroup, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { StorePayload } from "@/lib/api";
import type { Store } from "@/types";
import { useI18n } from "@/i18n/I18nProvider";
import { errorMessage } from "@/lib/error-message";

// Creates a store when `store` is omitted, edits it otherwise.
export function StoreFormModal({
  open,
  onClose,
  store,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  store?: Store;
  onSubmit: (payload: StorePayload) => Promise<void>;
}) {
  const { locale, t } = useI18n();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Re-seed the form each time the modal opens (see EditProfileModal).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(store?.name ?? "");
      setDescription(store?.description ?? "");
      setError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() });
      onClose();
    } catch (err) {
      setError(errorMessage(err, t, locale, t.store.saveError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={store ? t.store.edit : t.store.newStore}>
      <form onSubmit={handleSubmit}>
        <FieldGroup label={t.store.name}>
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder={t.store.namePlaceholder} />
        </FieldGroup>
        <FieldGroup label={t.store.description}>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.store.descriptionPlaceholder}
          />
        </FieldGroup>

        {error && <p className="mb-3 text-xs font-medium text-danger">{error}</p>}

        <Button type="submit" fullWidth disabled={submitting || !name.trim()}>
          {submitting ? t.common.saving : store ? t.profile.saveChanges : t.store.createStore}
        </Button>
      </form>
    </Modal>
  );
}
