import { describe, expect, it } from "vitest";

import { signedAngularDelta } from "../engine/angles.ts";
import { lahiriAyanamsa } from "../engine/ayanamsa.ts";
import { eclipticPosition, subPlanetPoint } from "../engine/positions.ts";
import { DAY_MS, toAstroTime } from "../engine/time.ts";
import type { GrahaId } from "../engine/zodiac.ts";
import {
  apply,
  earthInstantMs,
  earthToScene,
  eclipticToScene,
  geoToBody,
  multiply,
  rotationZ,
  sceneDirectionToGeo,
  sceneToEcliptic,
  transpose,
  type Matrix3,
} from "./frame.ts";

const INSTANTS = [
  new Date("1900-01-01T00:00:00Z"),
  new Date("1947-08-14T18:30:00Z"),
  new Date("1984-12-02T21:00:00Z"),
  new Date("2020-12-21T18:26:00Z"),
  new Date("2050-12-31T12:00:00Z"),
];

function expectClose(actual: number, expected: number, tolerance: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
}

function determinant(m: Matrix3): number {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

describe("scene frame", () => {
  it("puts sidereal 0 on +X and 90 degrees on +Y, so longitude runs counter-clockwise from +Z", () => {
    const zero = eclipticToScene(0);
    const ninety = eclipticToScene(90);
    expectClose(zero[0], 1, 1e-12, "0 deg x");
    expectClose(ninety[1], 1, 1e-12, "90 deg y");
    // The cross product of +X and +Y is +Z: a right-handed, counter-clockwise frame.
    const cross = zero[0] * ninety[1] - zero[1] * ninety[0];
    expect(cross).toBeGreaterThan(0.999);
    expect(sceneToEcliptic(eclipticToScene(123.4, -5.6, 2)).longitudeDeg).toBeCloseTo(123.4, 9);
  });

  it("rotates counter-clockwise with rotationZ", () => {
    const turned = apply(rotationZ(Math.PI / 2), [1, 0, 0]);
    expectClose(turned[0], 0, 1e-12, "x");
    expectClose(turned[1], 1, 1e-12, "y");
  });

  it("builds a proper rotation for the Earth at every test instant", () => {
    for (const instant of INSTANTS) {
      const m = earthToScene(instant);
      const product = multiply(m, transpose(m));
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          expectClose(product[row]![col]!, row === col ? 1 : 0, 1e-12, `m·mᵀ ${row}${col}`);
        }
      }
      expectClose(determinant(m), 1, 1e-12, "determinant");
    }
  });

  it("tilts the north pole toward tropical longitude 90 degrees, by the obliquity", () => {
    for (const instant of INSTANTS) {
      const pole = sceneToEcliptic(apply(earthToScene(instant), [0, 0, 1]));
      const ayanamsa = lahiriAyanamsa(toAstroTime(instant)).trueDegrees;
      // Tropical 90 degrees is sidereal 90 minus the ayanamsa.
      expectClose(Math.abs(signedAngularDelta(pole.longitudeDeg, 90 - ayanamsa)), 0, 0.01, "pole longitude");
      // The obliquity is about 23.44 degrees from 1900 to 2050.
      expectClose(pole.latitudeDeg, 90 - 23.44, 0.05, "pole latitude");
    }
  });

  it("puts the sub-planet points of the engine under the scene directions, within 0.1 degree", () => {
    const ids: GrahaId[] = ["sun", "moon", "mars", "jupiter", "rahu"];
    for (const instant of INSTANTS) {
      const earth = earthToScene(instant);
      for (const id of ids) {
        const position = eclipticPosition(id, instant);
        const direction = eclipticToScene(position.siderealLongitudeDeg, position.eclipticLatitudeDeg);
        const fromScene = sceneDirectionToGeo(instant, direction, earth);
        const fromEngine = subPlanetPoint(id, instant);
        const label = `${id} at ${instant.toISOString()}`;
        expectClose(fromScene.latitudeDeg, fromEngine.latitudeDeg, 0.1, `${label} latitude`);
        expectClose(
          Math.abs(signedAngularDelta(fromScene.longitudeDeg, fromEngine.longitudeDeg)),
          0,
          0.1,
          `${label} longitude`,
        );
      }
    }
  });

  it("turns Greenwich toward the Sun at about 12:00 UTC", () => {
    // Near an equinox, the equation of time is small: noon at Greenwich is
    // within about 8 minutes of 12:00 UTC, so the sub-solar longitude is near 0.
    const noon = new Date("2021-03-20T12:00:00Z");
    const sun = eclipticPosition("sun", noon);
    const subSolar = sceneDirectionToGeo(noon, eclipticToScene(sun.siderealLongitudeDeg, sun.eclipticLatitudeDeg));
    expectClose(Math.abs(subSolar.longitudeDeg), 0, 2.5, "sub-solar longitude at noon");
    expectClose(subSolar.latitudeDeg, 0, 0.5, "sub-solar latitude at the equinox");
  });

  it("maps a place on Earth into the scene and back", () => {
    const mathura = geoToBody(27.49, 77.67);
    const instant = INSTANTS[3] as Date;
    const m = earthToScene(instant);
    const back = sceneDirectionToGeo(instant, apply(m, mathura), m);
    expectClose(back.latitudeDeg, 27.49, 1e-9, "latitude");
    expectClose(back.longitudeDeg, 77.67, 1e-9, "longitude");
  });
});

describe("Earth motion rule", () => {
  const instant = Date.parse("2020-12-21T18:26:00Z");

  it("keeps the true time of day for steps under 1 day", () => {
    expect(earthInstantMs(instant, 3_600_000)).toBe(instant);
  });

  it("shows 00:00 UTC of the date for steps of 1 day or more", () => {
    expect(earthInstantMs(instant, DAY_MS)).toBe(Date.parse("2020-12-21T00:00:00Z"));
    expect(earthInstantMs(instant, 10 * DAY_MS)).toBe(Date.parse("2020-12-21T00:00:00Z"));
  });
});
