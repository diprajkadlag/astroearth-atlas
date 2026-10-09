import { MakeTime, Seasons } from "astronomy-engine";
import { describe, expect, it } from "vitest";

import { angularSeparation } from "./angles.ts";
import { eclipticPosition, skyAt, subPlanetPoint, type GrahaPosition } from "./positions.ts";

const find = (grahas: GrahaPosition[], id: GrahaPosition["id"]) => {
  const graha = grahas.find((candidate) => candidate.id === id);
  if (!graha) throw new Error(`missing ${id}`);
  return graha;
};

describe("sky at an instant", () => {
  const sky = skyAt(new Date("2024-04-08T18:00:00Z"));

  it("returns all 9 grahas with finite sidereal placements", () => {
    expect(sky.grahas.map((graha) => graha.id)).toEqual([
      "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "rahu", "ketu",
    ]);
    expect(sky.nodeModel).toBe("mean");
    for (const graha of sky.grahas) {
      expect(graha.siderealLongitudeDeg).toBeGreaterThanOrEqual(0);
      expect(graha.siderealLongitudeDeg).toBeLessThan(360);
      expect(Number.isFinite(graha.speedDegPerDay)).toBe(true);
      expect(graha.nakshatra.pada).toBeGreaterThanOrEqual(1);
      expect(graha.nakshatra.pada).toBeLessThanOrEqual(4);
    }
  });

  it("keeps mean Rahu and Ketu opposite and retrograde", () => {
    const rahu = find(sky.grahas, "rahu");
    const ketu = find(sky.grahas, "ketu");
    expect(angularSeparation(rahu.siderealLongitudeDeg, ketu.siderealLongitudeDeg)).toBeCloseTo(180, 10);
    expect(rahu.retrograde && ketu.retrograde).toBe(true);
  });

  it("finds Mercury retrograde and the Moon fast on the 2024 eclipse day", () => {
    const mercury = find(sky.grahas, "mercury");
    const moon = find(sky.grahas, "moon");
    expect(mercury.motion).toBe("retrograde");
    expect(moon.speedDegPerDay).toBeGreaterThan(10);
    expect(moon.speedDegPerDay).toBeLessThan(16);
    expect(angularSeparation(find(sky.grahas, "sun").siderealLongitudeDeg, moon.siderealLongitudeDeg)).toBeLessThan(0.25);
  });

  it("puts 6 grahas in sidereal Sagittarius at the 2019-12-26 annular eclipse", () => {
    const eclipse = skyAt(new Date("2019-12-26T05:17:40Z"));
    const sagittarius = eclipse.grahas
      .filter((graha) => graha.sign.name === "Sagittarius")
      .map((graha) => graha.id)
      .sort();
    expect(sagittarius).toEqual(["jupiter", "ketu", "mercury", "moon", "saturn", "sun"]);
  });
});

describe("true node", () => {
  it("stays within 1.96 degrees of the mean node from 1900 to 2050", () => {
    let largest = 0;
    for (let ms = Date.UTC(1900, 0, 1); ms < Date.UTC(2051, 0, 1); ms += 30 * 86_400_000) {
      const time = MakeTime(new Date(ms));
      const mean = eclipticPosition("rahu", time).tropicalLongitudeDeg;
      const osculating = eclipticPosition("rahu", time, { nodeModel: "true" }).tropicalLongitudeDeg;
      largest = Math.max(largest, angularSeparation(mean, osculating));
    }
    expect(largest).toBeGreaterThan(1);
    expect(largest).toBeLessThan(1.97);
  });
});

describe("sub-planet points", () => {
  it("puts the sub-solar point on the Tropic of Cancer at the June solstice", () => {
    const solstice = Seasons(2024).jun_solstice;
    expect(Math.abs(subPlanetPoint("sun", solstice).latitudeDeg - 23.44)).toBeLessThan(0.01);
  });

  it("brings the sub-solar and sub-lunar points together at a solar eclipse peak", () => {
    const peak = new Date("2024-04-08T18:17:19Z");
    const sun = subPlanetPoint("sun", peak);
    const moon = subPlanetPoint("moon", peak);
    expect(Math.abs(sun.latitudeDeg - moon.latitudeDeg)).toBeLessThan(1.5);
    expect(angularSeparation(sun.longitudeDeg, moon.longitudeDeg)).toBeLessThan(1.5);
  });
});
