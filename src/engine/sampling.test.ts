import { describe, expect, it } from "vitest";

import { decimateMinMax, packPieces, unwrapDegrees, wrapPolyline, type Point } from "./sampling.ts";

/** True when no piece draws a jump of more than `limit` degrees between neighbours. */
function noJumps(pieces: Point[][], limit = 180): boolean {
  return pieces.every((piece) =>
    piece.every((point, index) => index === 0 || Math.abs(point.y - piece[index - 1]!.y) < limit),
  );
}

describe("unwrapDegrees", () => {
  it("adds 360 at a forward wrap and subtracts it at a backward wrap", () => {
    expect(Array.from(unwrapDegrees([350, 355, 2, 8]))).toEqual([350, 355, 362, 368]);
    expect(Array.from(unwrapDegrees([10, 5, 358]))).toEqual([10, 5, -2]);
  });
});

describe("wrapPolyline", () => {
  it("breaks a forward crossing at 360 and restarts at 0", () => {
    expect(wrapPolyline([{ x: 0, y: 350 }, { x: 10, y: 370 }])).toEqual([
      [{ x: 0, y: 350 }, { x: 5, y: 360 }],
      [{ x: 5, y: 0 }, { x: 10, y: 10 }],
    ]);
  });

  it("breaks a retrograde crossing at 0 and restarts at 360", () => {
    expect(wrapPolyline([{ x: 0, y: 5 }, { x: 10, y: -5 }])).toEqual([
      [{ x: 0, y: 5 }, { x: 5, y: 0 }],
      [{ x: 5, y: 360 }, { x: 10, y: 355 }],
    ]);
  });
});

describe("decimateMinMax", () => {
  it("keeps at most 2 points per column and keeps a single-sample peak", () => {
    const xs = Array.from({ length: 1000 }, (_, index) => index);
    const ys = xs.map((x) => (x === 503 ? 90 : x / 100));
    const points = decimateMinMax(xs, ys, 0, 999, 10);
    expect(points.length).toBeLessThanOrEqual(20);
    expect(Math.max(...points.map((point) => point.y))).toBe(90);
  });

  it("does not draw a full-height line when a column crosses 360 degrees", () => {
    // One pixel column holds 358, 359, 0.5 and 1 degree. Unwrapping first
    // makes its min and max 358 and 361, which wrap into 2 short pieces.
    const xs = [0, 1, 2, 3, 4, 5, 6, 7];
    const ys = [356, 357, 358, 359, 0.5, 1, 2, 3];
    const pieces = wrapPolyline(decimateMinMax(xs, unwrapDegrees(ys), 0, 7, 2));
    expect(pieces.length).toBe(2);
    expect(noJumps(pieces)).toBe(true);
  });
});

describe("packPieces", () => {
  it("separates pieces with a NaN pair", () => {
    const packed = packPieces([[{ x: 0, y: 1 }], [{ x: 2, y: 3 }]]);
    expect(packed.length).toBe(6);
    expect(Number.isNaN(packed[2])).toBe(true);
    expect(Array.from(packed.slice(4))).toEqual([2, 3]);
  });
});
