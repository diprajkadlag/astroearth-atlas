/**
 * Turns longitude samples into drawable lines for the timeline lanes.
 *
 * Order of work: unwrap the longitudes (so a 359 -> 1 step is +2, not -358),
 * keep the minimum and maximum of each pixel column (so no peak is lost),
 * then wrap back into [0, 360) with an explicit break at each wrap (so the
 * lane never draws a full-height line). Unwrapping must come first: a pixel
 * column that crosses 360 would otherwise get min near 0 and max near 360.
 */

export interface Point {
  x: number;
  y: number;
}

/** Continuous longitudes: adds or subtracts 360 at each wrap of the input. */
export function unwrapDegrees(values: ArrayLike<number>): Float64Array {
  const unwrapped = new Float64Array(values.length);
  let offset = 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] as number;
    if (index > 0) {
      const step = value - (values[index - 1] as number);
      if (step > 180) offset -= 360;
      else if (step < -180) offset += 360;
    }
    unwrapped[index] = value + offset;
  }
  return unwrapped;
}

/**
 * Reduces samples to at most 2 points per pixel column: the column minimum
 * and maximum, in the order the line visits them. `xs` must increase.
 */
export function decimateMinMax(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  xStart: number,
  xEnd: number,
  columns: number,
): Point[] {
  const width = (xEnd - xStart) / columns;
  const points: Point[] = [];
  let column = -1;
  let first = 0;
  let last = 0;
  let min = Infinity;
  let max = -Infinity;
  let minX = 0;
  let maxX = 0;

  const flush = () => {
    if (column < 0) return;
    if (min === max) {
      points.push({ x: minX, y: min });
    } else if (last >= first) {
      points.push({ x: minX, y: min }, { x: maxX, y: max });
    } else {
      points.push({ x: maxX, y: max }, { x: minX, y: min });
    }
  };

  for (let index = 0; index < xs.length; index += 1) {
    const x = xs[index] as number;
    const y = ys[index] as number;
    if (x < xStart || x > xEnd) continue;
    const here = Math.min(columns - 1, Math.floor((x - xStart) / width));
    if (here !== column) {
      flush();
      column = here;
      first = y;
      min = Infinity;
      max = -Infinity;
    }
    if (y < min) {
      min = y;
      minX = x;
    }
    if (y > max) {
      max = y;
      maxX = x;
    }
    last = y;
  }
  flush();
  return points;
}

/**
 * Splits an unwrapped polyline into pieces inside [0, 360). Each wrap ends a
 * piece at the edge (360 going forward, 0 going backward) and starts the next
 * piece at the opposite edge, at the interpolated crossing point.
 */
export function wrapPolyline(points: readonly Point[]): Point[][] {
  const band = (y: number) => Math.floor(y / 360);
  const pieces: Point[][] = [];
  let current: Point[] = [];
  points.forEach((point, index) => {
    const previous = points[index - 1];
    if (previous) {
      let from = band(previous.y);
      const to = band(point.y);
      while (from !== to) {
        const forward = to > from;
        const boundary = (forward ? from + 1 : from) * 360;
        const t = (boundary - previous.y) / (point.y - previous.y);
        const x = previous.x + t * (point.x - previous.x);
        current.push({ x, y: forward ? 360 : 0 });
        pieces.push(current);
        current = [{ x, y: forward ? 0 : 360 }];
        from += forward ? 1 : -1;
      }
    }
    current.push({ x: point.x, y: point.y - 360 * band(point.y) });
  });
  if (current.length > 0) pieces.push(current);
  return pieces;
}

/**
 * Packs pieces into one transferable array: x0, y0, x1, y1, ... with a NaN
 * pair between pieces. A drawing loop moves (instead of lines) after a NaN.
 */
export function packPieces(pieces: readonly Point[][]): Float64Array {
  const length = pieces.reduce((sum, piece) => sum + piece.length * 2, 0) + Math.max(0, pieces.length - 1) * 2;
  const packed = new Float64Array(length);
  let offset = 0;
  pieces.forEach((piece, index) => {
    if (index > 0) {
      packed[offset] = Number.NaN;
      packed[offset + 1] = Number.NaN;
      offset += 2;
    }
    for (const point of piece) {
      packed[offset] = point.x;
      packed[offset + 1] = point.y;
      offset += 2;
    }
  });
  return packed;
}
