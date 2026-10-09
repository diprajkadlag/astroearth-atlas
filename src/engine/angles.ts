/** Angle helpers shared by the engine. Angles are in degrees unless a name says otherwise. */

export const DEG = Math.PI / 180;

export function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number.`);
  }
}

/** Wraps an angle into [0, 360). */
export function normalizeDegrees(value: number): number {
  assertFinite(value, "angle");
  const remainder = value % 360;
  if (Object.is(remainder, -0)) return 0;
  return remainder < 0 ? remainder + 360 : remainder;
}

/** Wraps an angle into [-180, 180), for example a terrestrial longitude. */
export function normalizeSignedDegrees(value: number): number {
  return ((normalizeDegrees(value) + 180) % 360) - 180;
}

/** Shortest signed motion from `fromDeg` to `toDeg`, in [-180, 180). */
export function signedAngularDelta(fromDeg: number, toDeg: number): number {
  return normalizeSignedDegrees(toDeg - fromDeg);
}

/** Unsigned separation of two longitudes, in [0, 180]. */
export function angularSeparation(aDeg: number, bDeg: number): number {
  return Math.abs(signedAngularDelta(aDeg, bDeg));
}
