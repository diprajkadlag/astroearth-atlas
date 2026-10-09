import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { angularSeparation } from "../src/engine/angles.ts";
import { DailyTable, type DailyTableManifest } from "../src/engine/dailyTable.ts";
import { siderealLongitude } from "../src/engine/positions.ts";
import { sampleSeries } from "../src/worker/sampleSeries.ts";

const DATA = new URL("../public/data/", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("sky-daily-1900-2050.json", DATA), "utf8"),
) as DailyTableManifest;
const bytes = readFileSync(new URL(manifest.file, DATA));
const table = new DailyTable(manifest, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

/** Half of one table step (360/65536 degrees) plus a little rounding room. */
const QUANTIZATION_DEG = 0.003;

describe("daily table", () => {
  it("covers 1900-01-01 to 2050-12-31 for 7 series", () => {
    expect(new Date(table.startMs).toISOString()).toBe("1900-01-01T00:00:00.000Z");
    expect(new Date(table.endMs).toISOString()).toBe("2050-12-31T00:00:00.000Z");
    expect(manifest.series).toEqual(["sun", "mercury", "venus", "mars", "jupiter", "saturn", "rahu"]);
  });

  it("matches the engine within one rounding step", () => {
    for (const day of [0, 7_305, 36_524, 43_820, 55_151]) {
      for (const id of manifest.series) {
        const expected = siderealLongitude(id, new Date(table.timeOfDay(day)));
        expect(angularSeparation(table.longitude(id, day), expected), `${id} on day ${day}`).toBeLessThan(QUANTIZATION_DEG);
      }
    }
  });

  it("derives Ketu from Rahu", () => {
    expect(angularSeparation(table.longitude("rahu", 1000), table.longitude("ketu", 1000))).toBeCloseTo(180, 10);
  });
});

describe("worker sampling", () => {
  const request = (ids: Parameters<typeof sampleSeries>[0]["ids"], start: string, end: string) => ({
    type: "sample" as const,
    requestId: 1,
    ids,
    startMs: Date.parse(start),
    endMs: Date.parse(end),
    columns: 1000,
  });

  /** Unpacks pieces and checks that no line jumps across the lane. */
  function pieceJumpsAreSmall(packed: Float64Array): boolean {
    for (let index = 2; index < packed.length; index += 2) {
      const y = packed[index + 1]!;
      const previousY = packed[index - 1]!;
      if (Number.isNaN(y) || Number.isNaN(previousY)) continue;
      if (Math.abs(y - previousY) > 180) return false;
    }
    return true;
  }

  it("serves 150 years of Saturn from the daily table without wrap jumps", () => {
    const [saturn] = sampleSeries(request(["saturn"], "1900-01-01", "2050-12-31"), table).series;
    expect(saturn?.source).toBe("daily-table");
    expect(saturn!.packed.length / 2).toBeLessThanOrEqual(2 * 1000 + 60);
    expect(pieceJumpsAreSmall(saturn!.packed)).toBe(true);
  });

  it("computes the Moon, and very short spans, with the engine", () => {
    const response = sampleSeries(request(["moon", "sun"], "2020-12-21T00:00:00Z", "2020-12-22T00:00:00Z"), table);
    expect(response.series.map((series) => series.source)).toEqual(["computed", "computed"]);
    expect(response.series.every((series) => pieceJumpsAreSmall(series.packed))).toBe(true);
  });
});
