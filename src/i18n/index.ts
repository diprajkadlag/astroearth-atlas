import { en, type MessageKey } from "./en.ts";

/**
 * Returns the interface text for a key, with {placeholders} filled in.
 * English is the only language in version 1.
 */
export function t(key: MessageKey, values: Readonly<Record<string, string | number>> = {}): string {
  return en[key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

const GRAHA_NAMES = {
  sun: "Sun",
  moon: "Moon",
  mercury: "Mercury",
  venus: "Venus",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  rahu: "Rahu",
  ketu: "Ketu",
} as const;

const GRAHA_ABBREVIATIONS = {
  sun: "Su",
  moon: "Mo",
  mercury: "Me",
  venus: "Ve",
  mars: "Ma",
  jupiter: "Ju",
  saturn: "Sa",
  rahu: "Ra",
  ketu: "Ke",
} as const;

export type NamedGraha = keyof typeof GRAHA_NAMES;

export function grahaName(id: NamedGraha): string {
  return GRAHA_NAMES[id];
}

/** The ring label of a graha (DESIGN.md): Su, Mo, Ma, Me, Ju, Ve, Sa, Ra, Ke. */
export function grahaAbbreviation(id: NamedGraha): string {
  return GRAHA_ABBREVIATIONS[id];
}
