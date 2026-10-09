import {
  NextGlobalSolarEclipse,
  NextLunarEclipse,
  SearchGlobalSolarEclipse,
  SearchLunarEclipse,
  type AstroTime,
} from "astronomy-engine";

import { siderealLongitude, subPlanetPoint, type GeoPoint } from "./positions.ts";
import { toAstroTime, type Instant } from "./time.ts";
import { getNakshatra } from "./zodiac.ts";

export interface SolarEclipseEvent {
  kind: "solar-eclipse";
  type: "partial" | "annular" | "total";
  peak: AstroTime;
  /** Peak of the central line, or the sub-solar point when there is none. */
  point: GeoPoint;
  /** False for partial eclipses: the shadow axis misses the Earth. */
  centralLine: boolean;
  siderealLongitudeDeg: number;
  nakshatraIndex: number;
}

export interface LunarEclipseEvent {
  kind: "lunar-eclipse";
  type: "penumbral" | "partial" | "total";
  peak: AstroTime;
  /** Centre of the hemisphere that sees the Moon at peak. */
  subLunarPoint: GeoPoint;
  siderealLongitudeDeg: number;
  nakshatraIndex: number;
}

function solarType(kind: string): SolarEclipseEvent["type"] {
  if (kind === "total" || kind === "annular") return kind;
  return "partial";
}

function lunarType(kind: string): LunarEclipseEvent["type"] {
  if (kind === "total" || kind === "partial") return kind;
  return "penumbral";
}

/** Solar eclipses whose peak falls in [start, end]. */
export function findSolarEclipses(start: Instant, end: Instant): SolarEclipseEvent[] {
  const last = toAstroTime(end);
  const events: SolarEclipseEvent[] = [];
  for (
    let info = SearchGlobalSolarEclipse(toAstroTime(start));
    info.peak.ut <= last.ut;
    info = NextGlobalSolarEclipse(info.peak)
  ) {
    const centralLine = info.latitude !== undefined && info.longitude !== undefined;
    const point: GeoPoint =
      info.latitude !== undefined && info.longitude !== undefined
        ? { latitudeDeg: info.latitude, longitudeDeg: info.longitude }
        : subPlanetPoint("sun", info.peak);
    const longitude = siderealLongitude("sun", info.peak);
    events.push({
      kind: "solar-eclipse",
      type: solarType(String(info.kind)),
      peak: info.peak,
      point,
      centralLine,
      siderealLongitudeDeg: longitude,
      nakshatraIndex: getNakshatra(longitude).index,
    });
  }
  return events;
}

/** Lunar eclipses whose peak falls in [start, end]. */
export function findLunarEclipses(start: Instant, end: Instant): LunarEclipseEvent[] {
  const last = toAstroTime(end);
  const events: LunarEclipseEvent[] = [];
  for (
    let info = SearchLunarEclipse(toAstroTime(start));
    info.peak.ut <= last.ut;
    info = NextLunarEclipse(info.peak)
  ) {
    const longitude = siderealLongitude("moon", info.peak);
    events.push({
      kind: "lunar-eclipse",
      type: lunarType(String(info.kind)),
      peak: info.peak,
      subLunarPoint: subPlanetPoint("moon", info.peak),
      siderealLongitudeDeg: longitude,
      nakshatraIndex: getNakshatra(longitude).index,
    });
  }
  return events;
}
