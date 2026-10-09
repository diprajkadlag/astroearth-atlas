// Ported from VedicAstrologer (same author, MIT), components/3d/camera-framing.ts.
const DEFAULT_FILL_RATIO = 0.72;

export interface PerspectiveFrameInput {
  width: number;
  height: number;
  verticalFovDeg: number;
  radius: number;
  /** Fraction of the limiting viewport dimension occupied by the sphere. */
  fillRatio?: number;
}

function distanceForHalfFov(
  radius: number,
  halfFovRad: number,
  fillRatio: number,
): number {
  const targetAngularRadius = Math.atan(
    Math.tan(halfFovRad) * fillRatio,
  );
  return radius / Math.sin(targetAngularRadius);
}

/**
 * Fits a bounding sphere against both axes of a perspective viewport.
 *
 * Using the sphere's angular radius avoids the clipping caused by treating
 * its centre plane as a flat rectangle. The result is deterministic across
 * embedded, fullscreen, landscape, and portrait canvas sizes.
 */
export function calculatePerspectiveFrameDistance({
  width,
  height,
  verticalFovDeg,
  radius,
  fillRatio = DEFAULT_FILL_RATIO,
}: PerspectiveFrameInput): number {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(verticalFovDeg) ||
    !Number.isFinite(radius) ||
    !Number.isFinite(fillRatio) ||
    width <= 0 ||
    height <= 0 ||
    verticalFovDeg <= 0 ||
    verticalFovDeg >= 179 ||
    radius <= 0 ||
    fillRatio <= 0 ||
    fillRatio >= 1
  ) {
    throw new RangeError("Perspective frame inputs must be finite and positive.");
  }

  const aspect = width / height;
  const verticalHalfFov = (verticalFovDeg * Math.PI) / 360;
  const horizontalHalfFov = Math.atan(
    Math.tan(verticalHalfFov) * aspect,
  );

  return Math.max(
    distanceForHalfFov(radius, verticalHalfFov, fillRatio),
    distanceForHalfFov(radius, horizontalHalfFov, fillRatio),
  );
}


export interface InstrumentFrameInput {
  width: number;
  height: number;
  verticalFovDeg: number;
  /** Camera height above the ecliptic plane, in degrees. */
  elevationDeg: number;
  /** Radius of the flat dial plate in the ecliptic plane. */
  plateRadius: number;
  /** Radius of the Earth sphere at the centre. */
  earthRadius: number;
  /** Fraction of each half field of view that the content may fill. */
  fillRatio?: number;
}

/**
 * Fits a wide, flat instrument: a dial plate in the ecliptic plane with the
 * Earth at its centre. A bounding sphere would leave wide empty bands on a
 * landscape screen, so this projects the plate rim exactly, with perspective,
 * and finds the nearest camera distance by bisection. The camera looks at
 * the centre from the given elevation.
 */
export function calculateInstrumentFrameDistance({
  width,
  height,
  verticalFovDeg,
  elevationDeg,
  plateRadius,
  earthRadius,
  fillRatio = 0.92,
}: InstrumentFrameInput): number {
  if (
    ![width, height, verticalFovDeg, elevationDeg, plateRadius, earthRadius, fillRatio].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    verticalFovDeg <= 0 ||
    verticalFovDeg >= 179 ||
    plateRadius <= 0 ||
    earthRadius <= 0 ||
    fillRatio <= 0 ||
    fillRatio > 1
  ) {
    throw new RangeError("Instrument frame inputs must be finite and positive.");
  }
  const tanV = Math.tan((verticalFovDeg * Math.PI) / 360) * fillRatio;
  const tanH = (tanV * width) / height;
  const el = (elevationDeg * Math.PI) / 180;
  // Camera frame for a camera on the +X side: right = +Y, up = (-sin el, 0, cos el).
  const forward = [-Math.cos(el), 0, -Math.sin(el)];
  const up = [-Math.sin(el), 0, Math.cos(el)];
  const rim = Array.from({ length: 360 }, (_, index) => {
    const angle = (index / 360) * Math.PI * 2;
    return [plateRadius * Math.cos(angle), plateRadius * Math.sin(angle), 0];
  });

  const fits = (distance: number) => {
    // The Earth sphere sits on the optical axis: its silhouette has angular radius asin(r / d).
    if (earthRadius >= distance) return false;
    const earthTan = Math.tan(Math.asin(earthRadius / distance));
    if (earthTan > tanV || earthTan > tanH) return false;
    const camera = [distance * Math.cos(el), 0, distance * Math.sin(el)];
    return rim.every((point) => {
      const v = [point[0]! - camera[0]!, point[1]! - camera[1]!, point[2]! - camera[2]!];
      const depth = v[0]! * forward[0]! + v[1]! * forward[1]! + v[2]! * forward[2]!;
      if (depth <= 0) return false;
      const x = v[1]!;
      const y = v[0]! * up[0]! + v[1]! * up[1]! + v[2]! * up[2]!;
      return Math.abs(x) / depth <= tanH && Math.abs(y) / depth <= tanV;
    });
  };

  let near = earthRadius;
  let far = 4 * (plateRadius + earthRadius) / Math.min(tanH, tanV);
  for (let step = 0; step < 60; step += 1) {
    const middle = (near + far) / 2;
    if (fits(middle)) far = middle;
    else near = middle;
  }
  return far;
}
