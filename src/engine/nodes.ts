import { GeoMoonState, RotateState, Rotation_EQJ_ECT, type AstroTime } from "astronomy-engine";

import { DEG, normalizeDegrees } from "./angles.ts";
import { centuriesTT } from "./time.ts";

/**
 * Mean ascending node of the Moon, referred to the mean equinox of date.
 * IERS Conventions (2003), Technical Note 32, chapter 5.
 */
export function meanNodeTropicalLongitude(time: AstroTime): number {
  const t = centuriesTT(time);
  const arcSeconds =
    450_160.398036 -
    6_962_890.5431 * t +
    7.4722 * t * t +
    0.007702 * t * t * t -
    0.00005939 * t * t * t * t;
  return normalizeDegrees(arcSeconds / 3600);
}

/**
 * Osculating ("true") ascending node, referred to the true equinox of date.
 * It is the direction in which the Moon's instantaneous orbital plane crosses
 * the true ecliptic upward: n = z × (r × v). From 1900 to 2050 it stays within
 * 1.96 degrees of the mean node (checked on 2026-10-09).
 */
export function trueNodeTropicalLongitude(time: AstroTime): number {
  const state = RotateState(Rotation_EQJ_ECT(time), GeoMoonState(time));
  const angularMomentumX = state.y * state.vz - state.z * state.vy;
  const angularMomentumY = state.z * state.vx - state.x * state.vz;
  return normalizeDegrees(Math.atan2(angularMomentumX, -angularMomentumY) / DEG);
}
