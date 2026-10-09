import { describe, expect, it } from "vitest";

import {
  calculateInstrumentFrameDistance,
  calculatePerspectiveFrameDistance,
} from "./camera-framing.ts";

function projectedFill(
  radius: number,
  distance: number,
  halfFovRad: number,
): number {
  const angularRadius = Math.asin(radius / distance);
  return Math.tan(angularRadius) / Math.tan(halfFovRad);
}

describe("responsive celestial camera framing", () => {
  it.each([
    { width: 1920, height: 920 },
    { width: 1920, height: 1080 },
    { width: 1024, height: 700 },
    { width: 390, height: 700 },
  ])("fits the outer sphere at $width x $height", ({ width, height }) => {
    const radius = 8;
    const verticalFovDeg = 46;
    const distance = calculatePerspectiveFrameDistance({
      width,
      height,
      verticalFovDeg,
      radius,
    });
    const verticalHalfFov = (verticalFovDeg * Math.PI) / 360;
    const horizontalHalfFov = Math.atan(
      Math.tan(verticalHalfFov) * (width / height),
    );

    expect(projectedFill(radius, distance, verticalHalfFov)).toBeLessThanOrEqual(
      0.7200001,
    );
    expect(
      projectedFill(radius, distance, horizontalHalfFov),
    ).toBeLessThanOrEqual(0.7200001);
    expect(
      Math.max(
        projectedFill(radius, distance, verticalHalfFov),
        projectedFill(radius, distance, horizontalHalfFov),
      ),
    ).toBeCloseTo(0.72, 8);
    expect(
      Math.max(
        projectedFill(radius, distance * 1.18, verticalHalfFov),
        projectedFill(radius, distance * 1.18, horizontalHalfFov),
      ),
    ).toBeGreaterThan(0.59);
  });

  it("rejects stale or impossible surface measurements", () => {
    expect(() =>
      calculatePerspectiveFrameDistance({
        width: 0,
        height: 920,
        verticalFovDeg: 46,
        radius: 8,
      }),
    ).toThrow(RangeError);
  });
});

describe("instrument framing", () => {
  function projected(distance: number, elevationDeg: number, point: [number, number, number]) {
    const el = (elevationDeg * Math.PI) / 180;
    const camera = [distance * Math.cos(el), 0, distance * Math.sin(el)];
    const v = [point[0] - camera[0]!, point[1] - camera[1]!, point[2] - camera[2]!];
    const depth = -v[0]! * Math.cos(el) - v[2]! * Math.sin(el);
    const y = -v[0]! * Math.sin(el) + v[2]! * Math.cos(el);
    return { x: v[1]! / depth, y: y / depth };
  }

  it.each([
    { width: 1440, height: 560 },
    { width: 860, height: 560 },
    { width: 390, height: 300 },
  ])("keeps the plate rim inside $width x $height, and one edge binds", ({ width, height }) => {
    const input = { width, height, verticalFovDeg: 36, elevationDeg: 28, plateRadius: 2.3, earthRadius: 1 };
    const distance = calculateInstrumentFrameDistance(input);
    const tanV = Math.tan((36 * Math.PI) / 360) * 0.92;
    const tanH = (tanV * width) / height;
    let fill = 0;
    for (let index = 0; index < 360; index += 1) {
      const angle = (index * Math.PI) / 180;
      const p = projected(distance, 28, [2.3 * Math.cos(angle), 2.3 * Math.sin(angle), 0]);
      fill = Math.max(fill, Math.abs(p.x) / tanH, Math.abs(p.y) / tanV);
    }
    const earth = Math.tan(Math.asin(1 / distance)) / Math.min(tanV, tanH);
    expect(Math.max(fill, earth)).toBeLessThanOrEqual(1 + 1e-6);
    expect(Math.max(fill, earth)).toBeGreaterThan(0.995);
  });

  it("rejects an empty viewport", () => {
    expect(() =>
      calculateInstrumentFrameDistance({
        width: 0,
        height: 300,
        verticalFovDeg: 36,
        elevationDeg: 28,
        plateRadius: 2.3,
        earthRadius: 1,
      }),
    ).toThrow(RangeError);
  });
});
