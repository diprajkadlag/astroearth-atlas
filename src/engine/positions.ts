import {
  Body,
  Ecliptic,
  EquatorFromVector,
  GeoVector,
  RotateVector,
  Rotation_ECT_EQD,
  Rotation_EQJ_EQD,
  SiderealTime,
  Vector,
  type AstroTime,
} from "astronomy-engine";

import { DEG, normalizeDegrees, normalizeSignedDegrees, signedAngularDelta } from "./angles.ts";
import { lahiriAyanamsa, type LahiriAyanamsa } from "./ayanamsa.ts";
import { meanNodeTropicalLongitude, trueNodeTropicalLongitude } from "./nodes.ts";
import { toAstroTime, type Instant } from "./time.ts";
import {
  GRAHA_IDS,
  zodiacPlacement,
  type GrahaId,
  type PhysicalGrahaId,
  type ZodiacPlacement,
} from "./zodiac.ts";

export type NodeModel = "mean" | "true";
export type Motion = "direct" | "retrograde" | "stationary";

export interface PositionOptions {
  /** Mean node is the default, as in VedicAstrologer and most Indian practice. */
  nodeModel?: NodeModel;
}

export interface EclipticPosition {
  /** Apparent geocentric longitude, true ecliptic and equinox of date. */
  tropicalLongitudeDeg: number;
  /** Tropical longitude minus the Lahiri ayanamsa. */
  siderealLongitudeDeg: number;
  eclipticLatitudeDeg: number;
  /** Earth-centre distance in astronomical units; null for Rahu and Ketu. */
  distanceAu: number | null;
}

export interface GrahaPosition extends EclipticPosition, ZodiacPlacement {
  id: GrahaId;
  speedDegPerDay: number;
  motion: Motion;
  /** True while longitude decreases, also inside the stationary band. */
  retrograde: boolean;
}

export interface SkySnapshot {
  instant: string;
  nodeModel: NodeModel;
  ayanamsa: LahiriAyanamsa;
  grahas: GrahaPosition[];
}

export interface EquatorialPosition {
  /** Apparent right ascension of date, in hours. */
  raHours: number;
  /** Apparent declination of date, in degrees. */
  decDeg: number;
}

export interface GeoPoint {
  latitudeDeg: number;
  /** Degrees east of Greenwich, in [-180, 180). */
  longitudeDeg: number;
}

const BODIES: Readonly<Record<PhysicalGrahaId, Body>> = {
  sun: Body.Sun,
  moon: Body.Moon,
  mercury: Body.Mercury,
  venus: Body.Venus,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
};

const SPEED_HALF_WINDOW_DAYS = 0.5;
const STATIONARY_THRESHOLD_DEG_PER_DAY = 0.01;

function nodePosition(
  id: "rahu" | "ketu",
  time: AstroTime,
  nodeModel: NodeModel,
  ayanamsa: LahiriAyanamsa,
): EclipticPosition {
  const offset = id === "ketu" ? 180 : 0;
  if (nodeModel === "mean") {
    // The mean node is referred to the mean equinox, so it takes the mean
    // ayanamsa. Adding nutation gives its true-equinox longitude for display.
    const meanTropical = normalizeDegrees(meanNodeTropicalLongitude(time) + offset);
    return {
      tropicalLongitudeDeg: normalizeDegrees(meanTropical + ayanamsa.nutationLongitudeDegrees),
      siderealLongitudeDeg: normalizeDegrees(meanTropical - ayanamsa.meanDegrees),
      eclipticLatitudeDeg: 0,
      distanceAu: null,
    };
  }
  const trueTropical = normalizeDegrees(trueNodeTropicalLongitude(time) + offset);
  return {
    tropicalLongitudeDeg: trueTropical,
    siderealLongitudeDeg: normalizeDegrees(trueTropical - ayanamsa.trueDegrees),
    eclipticLatitudeDeg: 0,
    distanceAu: null,
  };
}

/** Ecliptic position of one graha. Pass `ayanamsa` when it is already known for `time`. */
export function eclipticPosition(
  id: GrahaId,
  instant: Instant,
  options: PositionOptions = {},
  ayanamsa?: LahiriAyanamsa,
): EclipticPosition {
  const time = toAstroTime(instant);
  const lahiri = ayanamsa ?? lahiriAyanamsa(time);
  if (id === "rahu" || id === "ketu") {
    return nodePosition(id, time, options.nodeModel ?? "mean", lahiri);
  }
  // GeoVector + Ecliptic gives the apparent geocentric position on the true
  // ecliptic of date. EclipticLongitude() is not used: it is heliocentric.
  const vector = GeoVector(BODIES[id], time, true);
  const ecliptic = Ecliptic(vector);
  return {
    tropicalLongitudeDeg: ecliptic.elon,
    siderealLongitudeDeg: normalizeDegrees(ecliptic.elon - lahiri.trueDegrees),
    eclipticLatitudeDeg: ecliptic.elat,
    distanceAu: vector.Length(),
  };
}

export function siderealLongitude(
  id: GrahaId,
  instant: Instant,
  options: PositionOptions = {},
): number {
  return eclipticPosition(id, instant, options).siderealLongitudeDeg;
}

/** Longitude speed in degrees per day, as a centred difference over ±`halfWindowDays`. */
export function longitudeSpeed(
  id: GrahaId,
  instant: Instant,
  options: PositionOptions = {},
  halfWindowDays = SPEED_HALF_WINDOW_DAYS,
): number {
  const time = toAstroTime(instant);
  const before = siderealLongitude(id, time.AddDays(-halfWindowDays), options);
  const after = siderealLongitude(id, time.AddDays(halfWindowDays), options);
  return signedAngularDelta(before, after) / (2 * halfWindowDays);
}

function classifyMotion(id: GrahaId, speedDegPerDay: number): Motion {
  if (id === "sun" || id === "moon") return "direct";
  if (speedDegPerDay < -STATIONARY_THRESHOLD_DEG_PER_DAY) return "retrograde";
  if (speedDegPerDay > STATIONARY_THRESHOLD_DEG_PER_DAY) return "direct";
  return "stationary";
}

export function grahaPosition(
  id: GrahaId,
  instant: Instant,
  options: PositionOptions = {},
): GrahaPosition {
  const time = toAstroTime(instant);
  const position = eclipticPosition(id, time, options);
  const speedDegPerDay = longitudeSpeed(id, time, options);
  return {
    id,
    ...position,
    ...zodiacPlacement(position.siderealLongitudeDeg),
    speedDegPerDay,
    motion: classifyMotion(id, speedDegPerDay),
    retrograde: speedDegPerDay < 0,
  };
}

/** The whole sidereal sky at one instant. No observer is needed: positions are geocentric. */
export function skyAt(instant: Instant, options: PositionOptions = {}): SkySnapshot {
  const time = toAstroTime(instant);
  return {
    instant: time.date.toISOString(),
    nodeModel: options.nodeModel ?? "mean",
    ayanamsa: lahiriAyanamsa(time),
    grahas: GRAHA_IDS.map((id) => grahaPosition(id, time, options)),
  };
}

/** Apparent geocentric right ascension and declination, true equator and equinox of date. */
export function equatorialOfDate(
  id: GrahaId,
  instant: Instant,
  options: PositionOptions = {},
): EquatorialPosition {
  const time = toAstroTime(instant);
  let equatorOfDate: Vector;
  if (id === "rahu" || id === "ketu") {
    const longitude = eclipticPosition(id, time, options).tropicalLongitudeDeg * DEG;
    const onEcliptic = new Vector(Math.cos(longitude), Math.sin(longitude), 0, time);
    equatorOfDate = RotateVector(Rotation_ECT_EQD(time), onEcliptic);
  } else {
    equatorOfDate = RotateVector(Rotation_EQJ_EQD(time), GeoVector(BODIES[id], time, true));
  }
  const equatorial = EquatorFromVector(equatorOfDate);
  return { raHours: equatorial.ra, decDeg: equatorial.dec };
}

/**
 * The place on Earth where a graha stands at the zenith: latitude equals the
 * declination, longitude equals right ascension minus Greenwich apparent
 * sidereal time.
 */
export function subPlanetPoint(
  id: GrahaId,
  instant: Instant,
  options: PositionOptions = {},
): GeoPoint {
  const time = toAstroTime(instant);
  const { raHours, decDeg } = equatorialOfDate(id, time, options);
  return {
    latitudeDeg: decDeg,
    longitudeDeg: normalizeSignedDegrees((raHours - SiderealTime(time)) * 15),
  };
}
