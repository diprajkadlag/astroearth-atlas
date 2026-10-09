import { MakeTime, RotateVector, Rotation_EQJ_ECT, Vector } from "astronomy-engine";
import { describe, expect, it } from "vitest";

import { DEG, normalizeDegrees } from "./angles.ts";
import { lahiriAyanamsa } from "./ayanamsa.ts";

const at = (iso: string) => lahiriAyanamsa(MakeTime(new Date(iso)));

describe("Lahiri ayanamsa", () => {
  it("keeps the VedicAstrologer reference values", () => {
    expect(at("2000-01-01T12:00:00Z").meanDegrees).toBeCloseTo(23 + 51 / 60 + 25.5324 / 3600, 5);
    expect(at("2019-01-01T12:00:00Z").meanDegrees).toBeCloseTo(24 + 7 / 60 + 21.1353 / 3600, 5);
    expect(at("2020-01-01T12:00:00Z").meanDegrees).toBeCloseTo(24 + 8 / 60 + 11.3962 / 3600, 5);
  });

  it("matches the plan's check values within 0.01 degree", () => {
    expect(Math.abs(at("1900-01-01T00:00:00Z").meanDegrees - 22.46)).toBeLessThan(0.01);
    expect(Math.abs(at("2000-01-01T00:00:00Z").meanDegrees - 23.86)).toBeLessThan(0.01);
    expect(Math.abs(at("2050-01-01T00:00:00Z").meanDegrees - 24.56)).toBeLessThan(0.01);
  });

  it("adds a small nutation term for true-equinox positions", () => {
    const value = at("2024-04-08T18:00:00Z");
    expect(Math.abs(value.nutationLongitudeDegrees)).toBeLessThan(0.006);
    expect(value.trueDegrees).toBeCloseTo(value.meanDegrees + value.nutationLongitudeDegrees, 10);
  });

  it("keeps Spica (Chitra) at sidereal 179.98 degrees from 1900 to 2050", () => {
    // Hipparcos J2000 position; proper motion moves it about 2 arcseconds in 50 years.
    const ra = (13 + 25 / 60 + 11.579 / 3600) * 15 * DEG;
    const dec = -(11 + 9 / 60 + 40.75 / 3600) * DEG;
    const j2000 = MakeTime(new Date("2000-01-01T12:00:00Z"));
    const spica = new Vector(
      Math.cos(dec) * Math.cos(ra),
      Math.cos(dec) * Math.sin(ra),
      Math.sin(dec),
      j2000,
    );
    for (const year of [1900, 1950, 2000, 2020, 2050]) {
      const time = MakeTime(new Date(Date.UTC(year, 0, 1, 12)));
      // Ecliptic(vector) would take the epoch from the vector's own time
      // (J2000), so the rotation to the ecliptic of date is explicit.
      const ofDate = RotateVector(Rotation_EQJ_ECT(time), spica);
      const tropical = normalizeDegrees(Math.atan2(ofDate.y, ofDate.x) / DEG);
      const sidereal = normalizeDegrees(tropical - lahiriAyanamsa(time).trueDegrees);
      expect(Math.abs(sidereal - 179.98), `Spica in ${year}: ${sidereal}`).toBeLessThan(0.02);
    }
  });
});
