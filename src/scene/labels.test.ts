import { describe, expect, it } from "vitest";

import { isFarSide, isHiddenByEarth, placeLabels } from "./labels.ts";
import { ringTicks, RING_RADIUS } from "./ringGeometry.ts";

describe("label layer", () => {
  const camera = [6, 0, 0] as const;

  it("hides points behind the Earth and keeps the others", () => {
    expect(isHiddenByEarth(camera, [-1.8, 0, 0])).toBe(true);
    expect(isHiddenByEarth(camera, [1.8, 0, 0])).toBe(false);
    // Beside the Earth, the line of sight misses the sphere.
    expect(isHiddenByEarth(camera, [-1.8, 1.5, 0])).toBe(false);
  });

  it("tells the far half of the ring from the near half", () => {
    expect(isFarSide(camera, [-1, 0.5, 0])).toBe(true);
    expect(isFarSide(camera, [1, -0.5, 0])).toBe(false);
  });

  it("moves a clashing label outward and leaves distant ones alone", () => {
    const placed = placeLabels(
      [
        { x: 100, y: 100, dx: 1, dy: 0, halfWidth: 8 },
        { x: 104, y: 100, dx: 1, dy: 0, halfWidth: 8 },
        { x: 300, y: 100, dx: 1, dy: 0, halfWidth: 8 },
      ],
      { width: 400, height: 200 },
      14,
    );
    expect(placed[0]).toEqual({ x: 100, y: 100 });
    expect(placed[1]).toEqual({ x: 118, y: 100 });
    expect(placed[2]).toEqual({ x: 300, y: 100 });
  });

  it("keeps labels inside the canvas by moving them sideways", () => {
    // Both labels want the right edge; outward steps would leave the canvas.
    const placed = placeLabels(
      [
        { x: 380, y: 100, dx: 1, dy: 0, halfWidth: 8 },
        { x: 382, y: 100, dx: 1, dy: 0, halfWidth: 8 },
      ],
      { width: 400, height: 200 },
      14,
    );
    for (const label of placed) expect(label.x + 8).toBeLessThanOrEqual(396);
    const [a, b] = placed as [{ x: number; y: number }, { x: number; y: number }];
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(14);
  });
});

describe("ring geometry", () => {
  it("draws 360 degree ticks, 27 nakshatra ticks and 12 sign ticks", () => {
    const ticks = ringTicks();
    expect(ticks.degrees.length / 6).toBe(360);
    expect(ticks.nakshatras.length / 6).toBe(27);
    expect(ticks.signs.length / 6).toBe(12);
    // Sign 0 starts at sidereal 0 degrees, on +X.
    expect(ticks.signs[0]).toBeCloseTo(RING_RADIUS - 0.1, 6);
    expect(ticks.signs[1]).toBeCloseTo(0, 6);
    // The tick of Krittika (nakshatra 2) points to 26°40′.
    const angle = Math.atan2(ticks.nakshatras[2 * 6 + 1] as number, ticks.nakshatras[2 * 6] as number);
    expect((angle * 180) / Math.PI).toBeCloseTo(26 + 40 / 60, 4);
  });
});
