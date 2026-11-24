"use client";

import { useEffect, useRef } from "react";
import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries";

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isFormControl(target: EventTarget | null): target is FormControl {
  return (
    target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement
  );
}

function formatBound(el: FormControl, bound: string, locale: Locale): { value: string; isDate: boolean } {
  const type = el instanceof HTMLInputElement ? el.type : "";
  if (type === "datetime-local" || type === "date") {
    // Date-only strings parse as UTC; add a time so they parse in local time like datetime-local ones.
    const date = new Date(type === "date" ? `${bound}T00:00` : bound);
    if (!Number.isNaN(date.getTime())) {
      const options: Intl.DateTimeFormatOptions =
        type === "date" ? { dateStyle: "short" } : { dateStyle: "short", timeStyle: "short" };
      return { value: new Intl.DateTimeFormat(locale, options).format(date), isDate: true };
    }
    return { value: bound, isDate: true };
  }
  if (type === "time" || type === "month" || type === "week") return { value: bound, isDate: true };
  const n = Number(bound);
  return { value: Number.isNaN(n) ? bound : new Intl.NumberFormat(locale).format(n), isDate: false };
}

// The message for the control's current (native) validity state, or "" if it is valid.
export function validationMessage(el: FormControl, t: Dictionary["validation"], locale: Locale): string {
  const v = el.validity;
  const type = el instanceof HTMLInputElement ? el.type : "";

  if (v.valueMissing) {
    if (type === "checkbox") return t.checkboxMissing;
    if (type === "radio" || el instanceof HTMLSelectElement) return t.selectMissing;
    if (type === "file") return t.fileMissing;
    return t.valueMissing;
  }
  if (v.typeMismatch) {
    if (type === "email") return t.emailMismatch;
    if (type === "url") return t.urlMismatch;
    return t.invalidValue;
  }
  if (v.badInput) return type === "number" ? t.numberBadInput : t.invalidValue;
  if (v.tooShort && "minLength" in el) return t.tooShort(el.minLength, el.value.length);
  if (v.tooLong && "maxLength" in el) return t.tooLong(el.maxLength);
  if (v.rangeUnderflow && el instanceof HTMLInputElement) {
    const { value, isDate } = formatBound(el, el.min, locale);
    return isDate ? t.dateTooEarly(value) : t.numberTooLow(value);
  }
  if (v.rangeOverflow && el instanceof HTMLInputElement) {
    const { value, isDate } = formatBound(el, el.max, locale);
    return isDate ? t.dateTooLate(value) : t.numberTooHigh(value);
  }
  if (v.patternMismatch) return t.patternMismatch;
  if (v.stepMismatch) return t.invalidValue;
  return "";
}

/**
 * Browsers show native constraint-validation messages (e.g. for `required`) in the
 * browser's UI language, not the page's. This swaps them for messages in the app's
 * locale, for every form control on the page.
 */
export function useLocalizedValidation(locale: Locale, t: Dictionary["validation"]) {
  const current = useRef({ locale, t });
  useEffect(() => {
    current.current = { locale, t };
  }, [locale, t]);

  useEffect(() => {
    // Controls we gave a custom message. A custom message keeps a control invalid until
    // cleared, so clear it whenever the value may have changed or a submit may start.
    const flagged = new Set<FormControl>();

    const clear = (el: FormControl) => {
      el.setCustomValidity("");
      flagged.delete(el);
    };

    const onInvalid = (e: Event) => {
      if (!isFormControl(e.target)) return;
      const el = e.target;
      el.setCustomValidity("");
      const message = validationMessage(el, current.current.t, current.current.locale);
      if (message) {
        el.setCustomValidity(message);
        flagged.add(el);
      }
    };

    const onEdit = (e: Event) => {
      if (isFormControl(e.target) && flagged.has(e.target)) clear(e.target);
    };

    // Values set from code (e.g. an address lookup) fire no input event, so reset
    // everything before a click or Enter that could trigger validation again.
    const onMaybeSubmit = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Enter") return;
      flagged.forEach(clear);
    };

    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onEdit, true);
    document.addEventListener("change", onEdit, true);
    document.addEventListener("click", onMaybeSubmit, true);
    document.addEventListener("keydown", onMaybeSubmit, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onEdit, true);
      document.removeEventListener("change", onEdit, true);
      document.removeEventListener("click", onMaybeSubmit, true);
      document.removeEventListener("keydown", onMaybeSubmit, true);
      flagged.forEach(clear);
    };
  }, []);
}
