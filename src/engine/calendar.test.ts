import { describe, expect, it } from "vitest";

import { formatHistoricalDate, historicalDate, julianCalendarDate } from "./calendar.ts";

describe("historical calendar labels", () => {
  it("converts the last Julian day before the Gregorian reform", () => {
    expect(julianCalendarDate(2_299_160)).toEqual({ calendar: "julian", year: 1582, month: 10, day: 4 });
  });

  it("shows the 1345 great conjunction in the Julian calendar", () => {
    const instant = new Date("1345-04-01T12:15:00Z");
    expect(historicalDate(instant)).toEqual({ calendar: "julian", year: 1345, month: 3, day: 24 });
    expect(formatHistoricalDate(instant)).toBe("24 March 1345 (Julian)");
  });

  it("keeps Gregorian dates from 15 October 1582", () => {
    expect(formatHistoricalDate(new Date("1582-10-15T12:00:00Z"))).toBe("15 October 1582");
    expect(formatHistoricalDate(new Date("2020-12-21T18:26:00Z"))).toBe("21 December 2020");
  });
});
