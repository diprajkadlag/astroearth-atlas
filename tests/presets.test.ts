import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SKY_MOMENTS } from "../src/data/presets.ts";
import { skyAt } from "../src/engine/positions.ts";

function signsAt(ms: number): Map<string, string> {
  return new Map(skyAt(new Date(ms)).grahas.map((graha) => [graha.id, graha.sign.name]));
}

function moment(id: string) {
  const found = SKY_MOMENTS.find((item) => item.id === id);
  if (!found) throw new Error(`No sky moment ${id}`);
  return found;
}

describe("sky moments", () => {
  it("has 8 grahas in Capricorn on 5 February 1962", () => {
    const signs = signsAt(moment("eight-in-capricorn-1962").instantMs);
    const inCapricorn = [...signs].filter(([, sign]) => sign === "Capricorn").map(([id]) => id);
    expect(inCapricorn.sort()).toEqual(["jupiter", "ketu", "mars", "mercury", "moon", "saturn", "sun", "venus"]);
  });

  it("has 6 grahas in Sagittarius on 26 December 2019", () => {
    const signs = signsAt(moment("six-in-sagittarius-2019").instantMs);
    const inSagittarius = [...signs].filter(([, sign]) => sign === "Sagittarius").map(([id]) => id);
    expect(inSagittarius.sort()).toEqual(["jupiter", "ketu", "mercury", "moon", "saturn", "sun"]);
  });

  it("puts the great conjunction of 2020 at the searched instant", () => {
    const great = JSON.parse(readFileSync(new URL("../public/data/great-conjunctions-1000-2100.json", import.meta.url), "utf8")) as {
      conjunctions: { time: string }[];
    };
    const searched = great.conjunctions.find((item) => item.time.startsWith("2020-12-21"));
    expect(searched).toBeDefined();
    expect(Math.abs(Date.parse(searched!.time) - moment("great-conjunction-2020").instantMs)).toBeLessThanOrEqual(60_000);
  });
});
