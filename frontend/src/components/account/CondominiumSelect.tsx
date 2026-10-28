"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { fetchCondominiums, type Condominium } from "@/lib/api";
import { useI18n } from "@/i18n/I18nProvider";

// Rendering thousands of options makes the list useless anyway; past this the
// user is asked to keep typing.
const MAX_RESULTS = 50;

// Case- and accent-insensitive, so "sao" finds "São".
function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// A searchable picker over the condominiums admins maintain, since the list
// can be long. A resident whose condominium was since removed from the list
// still sees it selected, so saving their profile doesn't move them out of
// their community.
export function CondominiumSelect({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (name: string) => void;
  required?: boolean;
}) {
  const { t } = useI18n();
  const listId = useId();
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  // While open, the input holds the search text; closed, it shows the choice.
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

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
  const needle = normalize(query);
  const matches = needle ? names.filter((n) => normalize(n).includes(needle)) : names;
  const shown = matches.slice(0, MAX_RESULTS);

  function openList() {
    setOpen(true);
    setQuery("");
    setActive(0);
  }

  function choose(name: string) {
    onChange(name);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown") openList();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      // Picks the highlighted condominium instead of submitting the form.
      e.preventDefault();
      if (shown[active]) choose(shown[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        // Leaving the field without picking keeps the previous choice.
        required={required && !value}
        value={open ? query : value}
        placeholder={open && value ? value : t.auth.register.buildingPlaceholder}
        onFocus={openList}
        onClick={() => !open && openList()}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className="pr-9"
      />
      {!required && value && !open ? (
        <button
          type="button"
          aria-label={t.condominiumSearch.clear}
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-400 hover:text-ink"
        >
          <X size={16} />
        </button>
      ) : (
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
        />
      )}

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-line bg-paper py-1 shadow-lg"
        >
          {shown.map((name, i) => (
            <li
              key={name}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={name === value}
              // Fires before the input's blur closes the list.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(name);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "cursor-pointer px-3.5 py-2 text-sm text-ink",
                i === active && "bg-cream-100",
                name === value && "font-semibold"
              )}
            >
              {name}
            </li>
          ))}
          {shown.length === 0 && <li className="px-3.5 py-2 text-sm text-ink-400">{t.condominiumSearch.noResults}</li>}
          {matches.length > shown.length && (
            <li className="px-3.5 py-2 text-xs text-ink-400">
              {t.condominiumSearch.moreResults(matches.length - shown.length)}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
