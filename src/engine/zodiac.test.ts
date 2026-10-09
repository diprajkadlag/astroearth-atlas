import { describe, expect, it } from "vitest";

import { angularSeparation, normalizeDegrees, normalizeSignedDegrees, signedAngularDelta } from "./angles.ts";
import { elementOfSign, getNakshatra, getRasi, NAKSHATRA_SIZE_DEG, PADA_SIZE_DEG, zodiacPlacement } from "./zodiac.ts";

describe("angle helpers", () => {
  it("normalizes and unwraps circular angles", () => {
    expect(normalizeDegrees(-1)).toBe(359);
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(721)).toBe(1);
    expect(normalizeSignedDegrees(190)).toBe(-170);
    expect(signedAngularDelta(359, 1)).toBe(2);
    expect(signedAngularDelta(1, 359)).toBe(-2);
    expect(angularSeparation(10, 350)).toBe(20);
  });

  it("rejects values that are not finite", () => {
    expect(() => normalizeDegrees(Number.NaN)).toThrow(/finite/);
  });
});

describe("signs and nakshatras", () => {
  it("classifies sign boundaries and elements", () => {
    expect(getRasi(0)).toMatchObject({ index: 0, name: "Aries", element: "fire", degreeDeg: 0 });
    expect(getRasi(29.999).name).toBe("Aries");
    expect(getRasi(30)).toMatchObject({ index: 1, name: "Taurus", element: "earth" });
    expect(getRasi(275).name).toBe("Capricorn");
    expect(getRasi(359.999).name).toBe("Pisces");
    expect([0, 1, 2, 3, 4].map(elementOfSign)).toEqual(["fire", "earth", "air", "water", "fire"]);
  });

  it("classifies nakshatra and pada boundaries", () => {
    expect(getNakshatra(0)).toMatchObject({ index: 0, name: "Ashwini", lord: "ketu", pada: 1 });
    expect(getNakshatra(PADA_SIZE_DEG)).toMatchObject({ index: 0, pada: 2 });
    expect(getNakshatra(NAKSHATRA_SIZE_DEG)).toMatchObject({
      index: 1,
      name: "Bharani",
      lord: "venus",
      pada: 1,
    });
    expect(getNakshatra(180)).toMatchObject({ name: "Chitra", pada: 3 });
    expect(getNakshatra(359.999)).toMatchObject({ index: 26, name: "Revati", pada: 4 });
  });

  it("reports the distance to the nearest boundary", () => {
    const placement = zodiacPlacement(28.94);
    expect(placement.sign.name).toBe("Aries");
    expect(placement.signBoundaryDistanceDeg).toBeCloseTo(1.06, 10);
    expect(zodiacPlacement(45).signBoundaryDistanceDeg).toBe(15);
  });
});
