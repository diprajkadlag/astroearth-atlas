import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { between, firstAtOrAfter, parseSkyEvents } from "../src/data/skyEvents.ts";
import { DailyTable, type DailyTableManifest } from "../src/engine/dailyTable.ts";
import { sampleCycles } from "../src/worker/sampleCycles.ts";

const DATA = new URL("../public/data/", import.meta.url);
const raw = JSON.parse(readFileSync(new URL("sky-events-1900-2050.json", DATA), "utf8"));
const great = JSON.parse(readFileSync(new URL("great-conjunctions-1000-2100.json", DATA), "utf8"));
const events = parseSkyEvents(raw, great);

const manifest = JSON.parse(readFileSync(new URL("sky-daily-1900-2050.json", DATA), "utf8")) as DailyTableManifest;
const bytes = readFileSync(new URL(manifest.file, DATA));
const table = new DailyTable(manifest, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

describe("sky events", () => {
  it("reads every event and sorts each list by time", () => {
    expect(events.stations).toHaveLength(raw.stations.length);
    expect(events.eclipses).toHaveLength(raw.solarEclipses.length + raw.lunarEclipses.length);
    for (const list of [events.stations, events.conjunctions, events.eclipses, events.greatConjunctions]) {
      for (let index = 1; index < list.length; index += 1) {
        expect((list[index] as { timeMs: number }).timeMs).toBeGreaterThanOrEqual((list[index - 1] as { timeMs: number }).timeMs);
      }
    }
  });

  it("finds the great conjunction of 2020 and the eclipses around it", () => {
    const december2020 = between(events.greatConjunctions, Date.UTC(2020, 11, 1), Date.UTC(2020, 11, 31));
    expect(december2020).toHaveLength(1);
    expect(december2020[0]?.siderealSign).toBe("Capricorn");
    // The total solar eclipse of 2020-12-14 lies a week before it.
    const eclipses = between(events.eclipses, Date.UTC(2020, 11, 10), Date.UTC(2020, 11, 20));
    expect(eclipses.map((eclipse) => eclipse.kind)).toEqual(["solar"]);
    expect(eclipses[0]?.type).toBe("total");
  });

  it("searches sorted lists by time", () => {
    const list = [{ timeMs: 10 }, { timeMs: 20 }, { timeMs: 30 }];
    expect(firstAtOrAfter(list, 15)).toBe(1);
    expect(firstAtOrAfter(list, 30)).toBe(2);
    expect(firstAtOrAfter(list, 31)).toBe(3);
    expect(between(list, 10, 20)).toEqual([{ timeMs: 10 }, { timeMs: 20 }]);
  });
});

describe("cycles", () => {
  it("peaks at +1 for Jupiter and Saturn at the conjunction of 2020", () => {
    const response = sampleCycles(
      { type: "cycles", requestId: 1, pairs: [["jupiter", "saturn"]], startMs: Date.UTC(2020, 0, 1), endMs: Date.UTC(2022, 0, 1), columns: 400 },
      table,
    );
    const packed = response.series[0]?.packed ?? new Float64Array();
    let best = { x: 0, y: -2 };
    for (let k = 0; k < packed.length; k += 2) {
      if ((packed[k + 1] as number) > best.y) best = { x: packed[k] as number, y: packed[k + 1] as number };
    }
    expect(best.y).toBeGreaterThan(0.9999);
    // Within 2 days of 2020-12-21.
    expect(Math.abs(best.x - Date.UTC(2020, 11, 21))).toBeLessThan(2 * 86_400_000);
  });

  it("draws one unbroken line between -1 and +1, also when computed (the Moon)", () => {
    const response = sampleCycles(
      { type: "cycles", requestId: 2, pairs: [["sun", "moon"]], startMs: Date.UTC(2020, 11, 1), endMs: Date.UTC(2020, 11, 31), columns: 300 },
      table,
    );
    const packed = response.series[0]?.packed ?? new Float64Array();
    expect(packed.some(Number.isNaN)).toBe(false);
    const ys = Array.from(packed).filter((_, index) => index % 2 === 1);
    expect(Math.max(...ys)).toBeGreaterThan(0.99);
    expect(Math.min(...ys)).toBeLessThan(-0.99);
  });
});
