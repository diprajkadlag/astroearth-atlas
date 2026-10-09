import {
  RotateVector,
  Rotation_EQD_ECT,
  SiderealTime,
  Vector,
  type AstroTime,
} from "astronomy-engine";

import { DEG, normalizeDegrees, normalizeSignedDegrees } from "../engine/angles.ts";
import { lahiriAyanamsa } from "../engine/ayanamsa.ts";
import { DAY_MS, toAstroTime, type Instant } from "../engine/time.ts";

/**
 * The scene frame, and the rotation that places the Earth in it.
 *
 * Scene frame: right-handed, Z up, the sidereal ecliptic of date. +X points
 * to sidereal longitude 0 (the start of Ashwini), +Y to sidereal 90 degrees,
 * +Z to the north ecliptic pole. Seen from +Z, longitude increases
 * counter-clockwise.
 *
 * Earth body frame: +X points to latitude 0, longitude 0; +Y to latitude 0,
 * longitude 90 E; +Z to the north pole. Polar motion is ignored.
 *
 *   v_scene = Rz(-ayanamsa) · R(EQD -> ECT) · Rz(GAST) · v_body
 *
 * Rz(GAST) turns the body frame into the true equator and equinox of date
 * (EQD). R(EQD -> ECT) tilts that into the true ecliptic of date. Rz(-ayanamsa)
 * moves the zero point from the equinox to sidereal 0 degrees.
 */

export type Vec3 = readonly [number, number, number];
/** A 3 by 3 matrix as rows, applied to column vectors: v' = m · v. */
export type Matrix3 = readonly [Vec3, Vec3, Vec3];

export const IDENTITY: Matrix3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/** Counter-clockwise rotation about +Z, seen from +Z. */
export function rotationZ(angleRad: number): Matrix3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

export function multiply(a: Matrix3, b: Matrix3): Matrix3 {
  const row = (r: Vec3): Vec3 => [
    r[0] * b[0][0] + r[1] * b[1][0] + r[2] * b[2][0],
    r[0] * b[0][1] + r[1] * b[1][1] + r[2] * b[2][1],
    r[0] * b[0][2] + r[1] * b[1][2] + r[2] * b[2][2],
  ];
  return [row(a[0]), row(a[1]), row(a[2])];
}

export function apply(m: Matrix3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

/** For a rotation, the transpose is the inverse. */
export function transpose(m: Matrix3): Matrix3 {
  return [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];
}

/**
 * astronomy-engine's rotation from EQD to ECT as a row matrix. Each column is
 * the image of a basis vector, so this does not depend on how the library
 * stores its matrices.
 */
function equatorOfDateToEclipticOfDate(time: AstroTime): Matrix3 {
  const rotation = Rotation_EQD_ECT(time);
  const image = (x: number, y: number, z: number): Vec3 => {
    const v = RotateVector(rotation, new Vector(x, y, z, time));
    return [v.x, v.y, v.z];
  };
  const ex = image(1, 0, 0);
  const ey = image(0, 1, 0);
  const ez = image(0, 0, 1);
  return [
    [ex[0], ey[0], ez[0]],
    [ex[1], ey[1], ez[1]],
    [ex[2], ey[2], ez[2]],
  ];
}

/** The rotation that takes Earth body vectors into the scene frame at `instant`. */
export function earthToScene(instant: Instant): Matrix3 {
  const time = toAstroTime(instant);
  const gast = SiderealTime(time) * 15 * DEG;
  // The true ayanamsa, because planet longitudes are true-equinox longitudes.
  const ayanamsa = lahiriAyanamsa(time).trueDegrees * DEG;
  return multiply(
    rotationZ(-ayanamsa),
    multiply(equatorOfDateToEclipticOfDate(time), rotationZ(gast)),
  );
}

/** A point in the scene from sidereal longitude, ecliptic latitude and radius. */
export function eclipticToScene(
  siderealLongitudeDeg: number,
  latitudeDeg = 0,
  radius = 1,
): Vec3 {
  const longitude = siderealLongitudeDeg * DEG;
  const latitude = latitudeDeg * DEG;
  return [
    radius * Math.cos(latitude) * Math.cos(longitude),
    radius * Math.cos(latitude) * Math.sin(longitude),
    radius * Math.sin(latitude),
  ];
}

/** Sidereal longitude (degrees, [0, 360)) and latitude of a scene direction. */
export function sceneToEcliptic(v: Vec3): { longitudeDeg: number; latitudeDeg: number } {
  const length = Math.hypot(v[0], v[1], v[2]);
  return {
    longitudeDeg: normalizeDegrees(Math.atan2(v[1], v[0]) / DEG),
    latitudeDeg: Math.asin(v[2] / length) / DEG,
  };
}

/** A unit vector in the Earth body frame. */
export function geoToBody(latitudeDeg: number, longitudeDeg: number): Vec3 {
  return eclipticToScene(longitudeDeg, latitudeDeg, 1);
}

/** Latitude and longitude (east positive, [-180, 180)) of a body-frame direction. */
export function bodyToGeo(v: Vec3): { latitudeDeg: number; longitudeDeg: number } {
  const { longitudeDeg, latitudeDeg } = sceneToEcliptic(v);
  return { latitudeDeg, longitudeDeg: normalizeSignedDegrees(longitudeDeg) };
}

/**
 * The place on Earth under a scene direction at `instant`: the body-frame
 * direction of a scene vector. For the Sun this is the sub-solar point.
 */
export function sceneDirectionToGeo(
  instant: Instant,
  sceneDirection: Vec3,
  earthMatrix: Matrix3 = earthToScene(instant),
): { latitudeDeg: number; longitudeDeg: number } {
  return bodyToGeo(apply(transpose(earthMatrix), sceneDirection));
}

/**
 * DESIGN.md, Earth motion: for a date step under 1 day the Earth shows the
 * true time of day. For a step of 1 day or more it shows 00:00 UTC of the
 * date, so day steps and fast playback keep the globe calm.
 */
export function earthInstantMs(instantMs: number, stepMs: number): number {
  if (stepMs < DAY_MS) return instantMs;
  return Math.floor(instantMs / DAY_MS) * DAY_MS;
}
