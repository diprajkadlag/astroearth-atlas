import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { between, parseSkyEvents } from "../src/data/skyEvents.ts";
import { ECLIPSE_GLOW_WINDOW_MS, STATION_GLOW_WINDOW_MS, koormaGlow } from "../src/engine/koorma.ts";
import { skyAt } from "../src/engine/positions.ts";

const DATA = new URL("../public/data/", import.meta.url);
const raw = JSON.parse(readFileSync(new URL("sky-events-1900-2050.json", DATA), "utf8"));
const great = JSON.parse(readFileSync(new URL("great-conjunctions-1000-2100.json", DATA), "utf8"));
const events = parseSkyEvents(raw, great);

/** The glow as the app computes it (state/hooks.ts, readKoormaGlow), with the shipped data. */
function glowAt(instantMs: number) {
  return koormaGlow({
    instantMs,
    grahas: skyAt(new Date(instantMs)).grahas,
    eclipses: between(events.eclipses, instantMs - ECLIPSE_GLOW_WINDOW_MS, instantMs + ECLIPSE_GLOW_WINDOW_MS),
    stations: between(events.stations, instantMs - STATION_GLOW_WINDOW_MS, instantMs + STATION_GLOW_WINDOW_MS),
  });
}

describe("Koorma glow with the shipped sky data", () => {
  it("lights the west for the total solar eclipse in Jyeshtha of 14 December 2020", () => {
    const glow = glowAt(Date.UTC(2020, 11, 21));
    const west = glow.find((item) => item.region.id === "west");
    expect(west?.strength).toBe(3);
    expect(west?.reasons[0]).toMatchObject({ kind: "eclipse", eclipse: "solar", type: "total", nakshatra: 17 });
    // Rahu in Mrigashira lights the centre, Saturn in Uttara Ashadha the north-west, Mars in Revati the north-east.
    expect(glow.find((item) => item.region.id === "centre")?.strength).toBe(1);
    expect(glow.find((item) => item.region.id === "north-west")?.strength).toBe(1);
    expect(glow.find((item) => item.region.id === "north-east")?.strength).toBe(1);
    expect(glow.find((item) => item.region.id === "south")?.strength).toBe(0);
  });

  it("no longer lights the west 8 days after that eclipse, by the eclipse", () => {
    const glow = glowAt(Date.UTC(2020, 11, 22, 18));
    const west = glow.find((item) => item.region.id === "west");
    expect(west?.reasons.some((reason) => reason.kind === "eclipse")).toBe(false);
  });

  it("always lights the 2 regions of Rahu and Ketu, so the legend is never empty", () => {
    for (let year = 1900; year <= 2050; year += 7) {
      const lit = glowAt(Date.UTC(year, 5, 1)).filter((item) => item.strength > 0);
      expect(lit.length, String(year)).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("great conjunctions, 1000 to 2100", () => {
  it("keep both zodiacs, the elements and the triple groups", () => {
    const of2020 = events.greatConjunctions.find((item) => new Date(item.timeMs).getUTCFullYear() === 2020);
    expect(of2020).toMatchObject({ siderealSign: "Capricorn", siderealElement: "earth", tropicalSign: "Aquarius", tropicalElement: "air" });
    const triple = events.greatConjunctions.filter((item) => [1940, 1941].includes(new Date(item.timeMs).getUTCFullYear()));
    expect(triple).toHaveLength(3);
    expect(new Set(triple.map((item) => item.group)).size).toBe(1);
    expect(events.greatConjunctions.filter((item) => item.approximate).every((item) => new Date(item.timeMs).getUTCFullYear() < 1700)).toBe(true);
  });
});
