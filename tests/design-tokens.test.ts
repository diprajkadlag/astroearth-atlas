import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  GRAHA_COLOR_ORDER,
  GRAHA_COLOR_TOKENS,
  RULE_ALPHA,
  UI_COLORS,
  grahaColor,
  grahaDash,
  withAlpha,
} from "../src/design/palette.ts";

const TOKENS = readFileSync(new URL("../src/design/tokens.css", import.meta.url), "utf8");

/** Every `--color-name: #rrggbb` declaration of tokens.css. */
const HEX_TOKENS = new Map(
  [...TOKENS.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/g)].map(
    (match) => [match[1] as string, match[2] as string],
  ),
);

function relativeLuminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG 2 contrast ratio of 2 opaque colours. */
function contrast(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return ((light as number) + 0.05) / ((dark as number) + 0.05);
}

const SURFACES = [UI_COLORS.ground, UI_COLORS.dial, UI_COLORS.raised];

describe("design tokens", () => {
  it("keeps palette.ts equal to tokens.css", () => {
    for (const [name, hex] of Object.entries(UI_COLORS)) {
      expect(HEX_TOKENS.get(name), `--color-${name}`).toBe(hex);
    }
    for (const [name, hex] of Object.entries(GRAHA_COLOR_TOKENS)) {
      expect(HEX_TOKENS.get(`graha-${name}`), `--color-graha-${name}`).toBe(hex);
    }
    expect(TOKENS).toContain(`--color-rule: rgb(234 227 210 / ${RULE_ALPHA.rule})`);
    expect(TOKENS).toContain(`--color-rule-strong: rgb(234 227 210 / ${RULE_ALPHA.ruleStrong})`);
  });

  it("gives text at least 4.5:1 on every surface", () => {
    for (const text of [UI_COLORS.ivory, UI_COLORS.muted, UI_COLORS.brass, UI_COLORS.eclipse]) {
      for (const surface of SURFACES) {
        expect(contrast(text, surface), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("gives every graha mark at least 3:1 on every surface", () => {
    for (const color of Object.values(GRAHA_COLOR_TOKENS)) {
      for (const surface of SURFACES) {
        expect(contrast(color, surface), `${color} on ${surface}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("keeps one hue per graha, in the validated slot order", () => {
    expect([...GRAHA_COLOR_ORDER].sort()).toEqual(Object.keys(GRAHA_COLOR_TOKENS).sort());
    expect(new Set(Object.values(GRAHA_COLOR_TOKENS)).size).toBe(8);
    expect(grahaColor("rahu")).toBe(GRAHA_COLOR_TOKENS.nodes);
    expect(grahaColor("ketu")).toBe(GRAHA_COLOR_TOKENS.nodes);
    expect(grahaDash("ketu").length).toBeGreaterThan(0);
    expect(grahaDash("rahu")).toEqual([]);
  });

  it("writes canvas colours with an alpha", () => {
    expect(withAlpha("#c9a25e", 0.5)).toBe("rgba(201, 162, 94, 0.5)");
  });
});
