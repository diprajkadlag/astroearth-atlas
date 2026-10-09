import { describe, expect, it } from "vitest";

import { axisTicks } from "./ticks.ts";

describe("time axis ticks", () => {
  it("labels decades over the whole range on a wide screen", () => {
    const ticks = axisTicks(Date.UTC(1900, 0, 1), Date.UTC(2050, 11, 31), 1200);
    const labels = ticks.filter((tick) => tick.label).map((tick) => tick.label);
    expect(labels[0]).toBe("1900");
    expect(labels).toContain("2000");
    // Labels stay at least 84 px apart.
    const labelled = ticks.filter((tick) => tick.label);
    const pxPerMs = 1200 / (Date.UTC(2050, 11, 31) - Date.UTC(1900, 0, 1));
    for (let index = 1; index < labelled.length; index += 1) {
      const gap = ((labelled[index] as { ms: number }).ms - (labelled[index - 1] as { ms: number }).ms) * pxPerMs;
      expect(gap).toBeGreaterThanOrEqual(84);
    }
  });

  it("labels months in a 2-year span and marks year starts", () => {
    const ticks = axisTicks(Date.UTC(2019, 5, 1), Date.UTC(2021, 5, 1), 1100);
    const labelled = ticks.filter((tick) => tick.label);
    expect(labelled.some((tick) => tick.label === "2020" && tick.strong)).toBe(true);
    expect(labelled.some((tick) => tick.label === "Jul 2020")).toBe(true);
  });

  it("labels hours in a 2-day span", () => {
    const ticks = axisTicks(Date.UTC(2020, 11, 21), Date.UTC(2020, 11, 23), 1000);
    expect(ticks.some((tick) => tick.label === "06:00")).toBe(true);
    expect(ticks.some((tick) => tick.label === "22 Dec")).toBe(true);
  });

  it("returns nothing for an empty span", () => {
    expect(axisTicks(5, 5, 100)).toEqual([]);
  });
});
