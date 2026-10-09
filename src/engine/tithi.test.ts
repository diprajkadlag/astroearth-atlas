import { describe, expect, it } from "vitest";

import { siderealLongitude } from "./positions.ts";
import { tithiFromLongitudes } from "./tithi.ts";

describe("tithi", () => {
  it("counts 12-degree steps of the Moon's elongation", () => {
    expect(tithiFromLongitudes(100, 100).name).toBe("Shukla Pratipada");
    expect(tithiFromLongitudes(100, 100 + 12 * 8 + 1).name).toBe("Shukla Navami");
    expect(tithiFromLongitudes(100, 100 + 179.9).name).toBe("Purnima");
    expect(tithiFromLongitudes(100, 100 + 180).name).toBe("Krishna Pratipada");
    expect(tithiFromLongitudes(100, 100 - 0.1).name).toBe("Amavasya");
  });

  it("wraps across 0 degrees", () => {
    const tithi = tithiFromLongitudes(355, 7);
    expect(tithi.elongationDeg).toBeCloseTo(12, 9);
    expect(tithi.number).toBe(2);
    expect(tithi.paksha).toBe("shukla");
  });

  it("gives Purnima at the full Moon of 2024-10-17 11:26 UTC", () => {
    // Full Moon (Sharad Purnima 2024), published instant 2024-10-17 11:26 UTC.
    const instant = new Date("2024-10-17T11:20:00Z");
    const tithi = tithiFromLongitudes(siderealLongitude("sun", instant), siderealLongitude("moon", instant));
    expect(tithi.name).toBe("Purnima");
  });
});
