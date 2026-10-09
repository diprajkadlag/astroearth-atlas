import type { GrahaId } from "../engine/zodiac.ts";

/**
 * Colour values for canvas and WebGL code, which cannot read CSS variables
 * cheaply. They equal the tokens in src/design/tokens.css, and
 * tests/design-tokens.test.ts fails when the 2 files differ. DESIGN.md gives
 * the job of each colour.
 */
export const UI_COLORS = {
  ground: "#0e1330",
  dial: "#070a1c",
  raised: "#151b3d",
  ivory: "#eae3d2",
  muted: "#a8a493",
  brass: "#c9a25e",
  eclipse: "#f6eeda",
} as const;

export type UiColorName = keyof typeof UI_COLORS;

/** Hairline alphas over ivory, as in the rule tokens. */
export const RULE_ALPHA = { rule: 0.16, ruleStrong: 0.32 } as const;

/**
 * The 8 hue families of the validated categorical palette (the dataviz
 * reference, dark steps), one per graha. Rahu and Ketu share the nodes hue.
 * Identity never rests on colour alone: every graha also carries a label.
 */
export const GRAHA_COLOR_TOKENS = {
  moon: "#3987e5",
  sun: "#d95926",
  nodes: "#199e70",
  jupiter: "#c98500",
  venus: "#d55181",
  mercury: "#008300",
  saturn: "#9085e9",
  mars: "#e66767",
} as const;

export type GrahaColorToken = keyof typeof GRAHA_COLOR_TOKENS;

/** The validated slot order. Keep it: the order is part of the colour-blind check. */
export const GRAHA_COLOR_ORDER: readonly GrahaColorToken[] = [
  "moon",
  "sun",
  "nodes",
  "jupiter",
  "venus",
  "mercury",
  "saturn",
  "mars",
];

export function grahaColor(id: GrahaId): string {
  return id === "rahu" || id === "ketu" ? GRAHA_COLOR_TOKENS.nodes : GRAHA_COLOR_TOKENS[id];
}

/** Ketu shares the Rahu hue, so its line is dotted. */
export function grahaDash(id: GrahaId): readonly number[] {
  return id === "ketu" ? [2, 3] : [];
}

/** "#rrggbb" plus an alpha, as an rgba() string for canvas styles. */
export function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
