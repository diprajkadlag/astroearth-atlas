import { describe, expect, it } from "vitest";

import { formatHistoricalDate } from "./calendar.ts";
import { findLunarEclipses, findSolarEclipses } from "./eclipses.ts";
import { findGreatConjunctions } from "./greatConjunctions.ts";
import { findIngresses, findKalaSarpaWindows, findStations } from "./search.ts";

const DAY_MS = 86_400_000;
const hoursBetween = (a: Date, b: Date) => Math.abs(a.getTime() - b.getTime()) / 3_600_000;

describe("great conjunctions 1900 to 2050", () => {
  const list = findGreatConjunctions(new Date("1900-01-01"), new Date("2051-01-01"));

  it("finds every published conjunction within 1 day, including the triples", () => {
    const expected = [
      "1901-11-28", "1921-09-10", "1940-08-08", "1940-10-20", "1941-02-15",
      "1961-02-18", "1980-12-31", "1981-03-04", "1981-07-24", "2000-05-28",
      "2020-12-21", "2040-10-31",
    ];
    expect(list).toHaveLength(expected.length);
    list.forEach((conjunction, index) => {
      const published = new Date(`${expected[index]}T12:00:00Z`);
      expect(Math.abs(conjunction.time.date.getTime() - published.getTime())).toBeLessThan(1.5 * DAY_MS);
    });
  });

  it("groups the triple conjunctions of 1940-41 and 1980-81", () => {
    const groups = list.map((conjunction) => conjunction.group);
    expect(groups.filter((group) => group === groups[2])).toHaveLength(3);
    expect(groups.filter((group) => group === groups[6])).toHaveLength(3);
  });

  it("places 2020 at about 6.4 degrees sidereal Capricorn and tropical Aquarius", () => {
    const year2020 = list.find((conjunction) => conjunction.time.date.getUTCFullYear() === 2020);
    expect(year2020).toBeDefined();
    expect(hoursBetween(year2020!.time.date, new Date("2020-12-21T18:26:00Z"))).toBeLessThan(1);
    expect(year2020!.sidereal.name).toBe("Capricorn");
    expect(year2020!.sidereal.degreeDeg).toBeCloseTo(6.4, 0);
    expect(year2020!.sidereal.element).toBe("earth");
    expect(year2020!.tropicalSignIndex).toBe(10);
    expect(year2020!.tropicalElement).toBe("air");
  });
});

describe("deep-time great conjunctions", () => {
  const near = (iso: string) =>
    findGreatConjunctions(new Date(new Date(iso).getTime() - 10 * DAY_MS), new Date(new Date(iso).getTime() + 10 * DAY_MS));

  it("finds 1206, 1345 and 1603 within 1 hour of the bisection check", () => {
    for (const iso of ["1206-04-23T20:34:00Z", "1345-04-01T12:15:00Z", "1603-12-18T06:59:00Z"]) {
      const [found] = near(iso);
      expect(found, iso).toBeDefined();
      expect(hoursBetween(found!.time.date, new Date(iso))).toBeLessThan(1);
      expect(found!.approximate).toBe(true);
    }
  });

  it("labels 1345 with its Julian date and sidereal Aquarius", () => {
    const [found] = near("1345-04-01T12:15:00Z");
    expect(formatHistoricalDate(found!.time.date)).toBe("24 March 1345 (Julian)");
    expect(found!.sidereal.name).toBe("Aquarius");
  });
});

describe("ingresses", () => {
  it("finds Saturn's sidereal sign changes of 2020 to 2023, including the retrograde return", () => {
    const events = findIngresses("saturn", "sign", new Date("2019-12-01"), new Date("2023-03-01"), 1);
    const summary = events.map((event) => [event.time.date.toISOString().slice(0, 10), event.to, event.retrograde]);
    expect(summary).toEqual([
      ["2020-01-24", 9, false],
      ["2022-04-29", 10, false],
      ["2022-07-12", 9, true],
      ["2023-01-17", 10, false],
    ]);
  });

  it("finds Jupiter entering Taurus and mean Rahu entering Pisces on their panchang dates", () => {
    const [jupiter] = findIngresses("jupiter", "sign", new Date("2024-04-01"), new Date("2024-06-01"), 1);
    expect(jupiter?.time.date.toISOString().slice(0, 10)).toBe("2024-05-01");
    const [rahu] = findIngresses("rahu", "sign", new Date("2023-10-01"), new Date("2023-12-01"), 1);
    expect(rahu?.time.date.toISOString().slice(0, 10)).toBe("2023-10-30");
    expect(rahu?.retrograde).toBe(true);
  });
});

describe("stations", () => {
  it("finds Mercury's April 2024 stations within 6 hours of the almanac times", () => {
    const stations = findStations("mercury", new Date("2024-03-15"), new Date("2024-05-15"));
    expect(stations.map((station) => station.turns)).toEqual(["retrograde", "direct"]);
    expect(hoursBetween(stations[0]!.time.date, new Date("2024-04-01T22:14:00Z"))).toBeLessThan(6);
    expect(hoursBetween(stations[1]!.time.date, new Date("2024-04-25T12:54:00Z"))).toBeLessThan(6);
  });
});

describe("Kala Sarpa windows", () => {
  const windows = findKalaSarpaWindows(new Date("2019-06-01"), new Date("2021-06-01"));

  it("contains 2020-03-20 and not 2020-03-10", () => {
    const inside = (iso: string) =>
      windows.some((window) => window.start.date <= new Date(iso) && new Date(iso) <= window.end.date);
    expect(inside("2020-03-20T00:00:00Z")).toBe(true);
    expect(inside("2020-03-10T00:00:00Z")).toBe(false);
  });

  it("keeps every window shorter than about 15 days, because the Moon breaks it", () => {
    for (const window of windows) {
      expect(window.end.ut - window.start.ut).toBeLessThan(15.5);
    }
  });
});

describe("eclipses", () => {
  it("finds the peak points of the 2017 and 2024 total solar eclipses within 0.1 degree", () => {
    const [eclipse2017] = findSolarEclipses(new Date("2017-08-15"), new Date("2017-08-31"));
    expect(eclipse2017?.type).toBe("total");
    expect(eclipse2017!.point.latitudeDeg).toBeCloseTo(36.98, 1);
    expect(eclipse2017!.point.longitudeDeg).toBeCloseTo(-87.66, 1);

    const [eclipse2024] = findSolarEclipses(new Date("2024-04-01"), new Date("2024-04-30"));
    expect(eclipse2024?.type).toBe("total");
    expect(eclipse2024!.point.latitudeDeg).toBeCloseTo(25.29, 1);
    expect(eclipse2024!.point.longitudeDeg).toBeCloseTo(-104.14, 1);
  });

  it("falls back to the sub-solar point for a partial eclipse", () => {
    const [partial] = findSolarEclipses(new Date("2022-10-20"), new Date("2022-10-31"));
    expect(partial?.type).toBe("partial");
    expect(partial?.centralLine).toBe(false);
    expect(partial!.point.latitudeDeg).toBeCloseTo(-12.2, 0);
  });

  it("finds the total lunar eclipse of 2022-11-08", () => {
    const [lunar] = findLunarEclipses(new Date("2022-11-01"), new Date("2022-11-30"));
    expect(lunar?.type).toBe("total");
    expect(lunar?.peak.date.toISOString().slice(0, 10)).toBe("2022-11-08");
  });
});
