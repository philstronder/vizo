import type { Locale } from "../config";
import { enUS, type Dictionary } from "./en-US";
import { ptBR } from "./pt-BR";

export type { Dictionary };

const dictionaries: Record<Locale, Dictionary> = {
  "pt-BR": ptBR,
  "en-US": enUS,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
