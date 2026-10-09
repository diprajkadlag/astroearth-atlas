import type { AstroTime } from "astronomy-engine";

import { DEG, normalizeDegrees } from "./angles.ts";
import { centuriesTT } from "./time.ts";

/**
 * Mean Lahiri (Chitrapaksha) ayanamsa at J2000.0, the anchor used by
 * VedicAstrologer and checked there against the Indian Astronomical Ephemeris
 * convention. A check in this project: with this anchor, Spica (Chitra) stays
 * at sidereal 179.984 degrees from 1900 to 2050.
 */
export const LAHIRI_J2000_MEAN_DEG = 23 + 51 / 60 + 25.5324 / 3600;

export interface LahiriAyanamsa {
  model: "Lahiri (IAE anchor, IAU 1976 precession)";
  meanDegrees: number;
  nutationLongitudeDegrees: number;
  /** Mean value plus nutation: subtract it from true-equinox longitudes. */
  trueDegrees: number;
}

export function lahiriAyanamsa(time: AstroTime): LahiriAyanamsa {
  const t = centuriesTT(time);
  // IAU 1976 general precession in longitude (Lieske et al. 1977), arcseconds.
  const precessionArcSeconds = 5029.0966 * t + 1.11113 * t * t - 0.000006 * t * t * t;
  const meanDegrees = normalizeDegrees(
    LAHIRI_J2000_MEAN_DEG + precessionArcSeconds / 3600,
  );

  // Truncated IAU 1980 nutation in longitude: 4 terms, about 0.5 arcsecond.
  const sunMeanLongitude = normalizeDegrees(280.4665 + 36_000.7698 * t);
  const moonMeanLongitude = normalizeDegrees(218.3165 + 481_267.8813 * t);
  const moonNode = normalizeDegrees(125.04452 - 1934.136261 * t);
  const nutationArcSeconds =
    -17.2 * Math.sin(moonNode * DEG) -
    1.32 * Math.sin(2 * sunMeanLongitude * DEG) -
    0.23 * Math.sin(2 * moonMeanLongitude * DEG) +
    0.21 * Math.sin(2 * moonNode * DEG);
  const nutationLongitudeDegrees = nutationArcSeconds / 3600;

  return {
    model: "Lahiri (IAE anchor, IAU 1976 precession)",
    meanDegrees,
    nutationLongitudeDegrees,
    trueDegrees: normalizeDegrees(meanDegrees + nutationLongitudeDegrees),
  };
}
