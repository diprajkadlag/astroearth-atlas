import { DEG, normalizeDegrees, normalizeSignedDegrees } from "./angles.ts";
import type { GeoPoint } from "./positions.ts";
import { getNakshatra, type GrahaId } from "./zodiac.ts";

/**
 * The Koorma Chakra (Brihat Samhita, chapter 14, translated by N. Chidambaram
 * Iyer, 1884, public domain). Stanza 1 divides the lands into 9 divisions,
 * from the centre of Bharatavarsha round through the east, the south-east, the
 * south and so on, each ruled by 3 nakshatras, beginning with Krittika. The
 * app centres the chakra on Mathura, which stanzas 2 to 4 name in the central
 * division (Madhyadesha). docs/METHOD.md lists the lands of each division.
 */

export const KOORMA_CENTRE: GeoPoint = { latitudeDeg: 27.49, longitudeDeg: 77.67 };
/** DESIGN.md: the centre region has a radius of 5.5 degrees around Mathura. */
export const CENTRE_RADIUS_DEG = 5.5;
/**
 * Classical mode covers the land within 25 degrees of Mathura (about 2,800 km):
 * the subcontinent and its rim, from Afghanistan to Burma and Sri Lanka.
 */
export const CLASSICAL_RADIUS_DEG = 25;
/** Global mode, a modern extension: the half of the Earth around the centre. */
export const GLOBAL_RADIUS_DEG = 90;

export type KoormaMode = "global" | "classical";

export type KoormaRegionId =
  | "centre"
  | "east"
  | "south-east"
  | "south"
  | "south-west"
  | "west"
  | "north-west"
  | "north"
  | "north-east";

export interface KoormaRegion {
  id: KoormaRegionId;
  /** Compass bearing of the middle of the wedge (0 north, 90 east), or null for the centre. */
  bearingDeg: number | null;
  /** Indices into NAKSHATRAS, in the order of the text. */
  nakshatras: readonly [number, number, number];
  /** The stanzas of chapter 14 that list the lands of the division. */
  stanzas: string;
}

/** The 9 divisions in the order of the text (14.2 to 14.31). */
export const KOORMA_REGIONS: readonly KoormaRegion[] = [
  { id: "centre", bearingDeg: null, nakshatras: [2, 3, 4], stanzas: "2–4" },
  { id: "east", bearingDeg: 90, nakshatras: [5, 6, 7], stanzas: "5–7" },
  { id: "south-east", bearingDeg: 135, nakshatras: [8, 9, 10], stanzas: "8–10" },
  { id: "south", bearingDeg: 180, nakshatras: [11, 12, 13], stanzas: "11–16" },
  { id: "south-west", bearingDeg: 225, nakshatras: [14, 15, 16], stanzas: "17–19" },
  { id: "west", bearingDeg: 270, nakshatras: [17, 18, 19], stanzas: "20–21" },
  { id: "north-west", bearingDeg: 315, nakshatras: [20, 21, 22], stanzas: "22–23" },
  { id: "north", bearingDeg: 0, nakshatras: [23, 24, 25], stanzas: "24–28" },
  { id: "north-east", bearingDeg: 45, nakshatras: [26, 0, 1], stanzas: "29–31" },
];

/** The 8 wedges by compass sector: 0 north, 1 north-east, ... 7 north-west. */
export const KOORMA_WEDGES: readonly KoormaRegionId[] = [
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
];

export function koormaRegion(id: KoormaRegionId): KoormaRegion {
  const region = KOORMA_REGIONS.find((candidate) => candidate.id === id);
  if (!region) throw new RangeError(`Unknown Koorma region: ${id}`);
  return region;
}

/** The division that a nakshatra rules (0 Ashwini to 26 Revati). */
export function regionOfNakshatra(index: number): KoormaRegion {
  const nakshatra = ((Math.trunc(index) % 27) + 27) % 27;
  const region = KOORMA_REGIONS.find((candidate) => candidate.nakshatras.includes(nakshatra));
  if (!region) throw new RangeError(`No Koorma region for nakshatra ${index}`);
  return region;
}

/** Great-circle distance between 2 points, in degrees of arc. */
export function angularDistanceDeg(a: GeoPoint, b: GeoPoint): number {
  const lat1 = a.latitudeDeg * DEG;
  const lat2 = b.latitudeDeg * DEG;
  const dLat = lat2 - lat1;
  const dLon = (b.longitudeDeg - a.longitudeDeg) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / DEG;
}

/** Initial compass bearing of the great circle from `from` to `to`, in [0, 360). */
export function greatCircleBearingDeg(from: GeoPoint, to: GeoPoint): number {
  const lat1 = from.latitudeDeg * DEG;
  const lat2 = to.latitudeDeg * DEG;
  const dLon = (to.longitudeDeg - from.longitudeDeg) * DEG;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return normalizeDegrees(Math.atan2(y, x) / DEG);
}

const POLE_LIMIT_DEG = 89.999;

/** Mercator ordinate of a latitude (the isometric latitude), in radians. */
function isometricLatitude(latitudeDeg: number): number {
  const latitude = Math.max(-POLE_LIMIT_DEG, Math.min(POLE_LIMIT_DEG, latitudeDeg)) * DEG;
  return Math.log(Math.tan(Math.PI / 4 + latitude / 2));
}

/**
 * Compass bearing of the rhumb line from `from` to `to`, in [0, 360): the
 * constant direction of a straight line on a Mercator map. Global mode uses
 * it, so that a place reads in the direction that a map shows. A great circle
 * from India to Alaska starts almost due north; the rhumb line runs east.
 */
export function rhumbBearingDeg(from: GeoPoint, to: GeoPoint): number {
  const dLon = normalizeSignedDegrees(to.longitudeDeg - from.longitudeDeg) * DEG;
  const dPsi = isometricLatitude(to.latitudeDeg) - isometricLatitude(from.latitudeDeg);
  return normalizeDegrees(Math.atan2(dLon, dPsi) / DEG);
}

export interface KoormaPlace {
  /** The division of the place, or null outside the chakra. */
  region: KoormaRegionId | null;
  distanceDeg: number;
  bearingDeg: number;
}

/**
 * The division of a place. The centre region is a circle of 5.5 degrees. The
 * 8 directions are wedges of 45 degrees around it: great-circle bearings in
 * classical mode (up to 25 degrees away), rhumb-line bearings in global mode
 * (the half of the Earth around the centre).
 */
export function koormaRegionAt(point: GeoPoint, mode: KoormaMode, centre: GeoPoint = KOORMA_CENTRE): KoormaPlace {
  const distanceDeg = angularDistanceDeg(centre, point);
  const bearingDeg = mode === "classical" ? greatCircleBearingDeg(centre, point) : rhumbBearingDeg(centre, point);
  if (distanceDeg <= CENTRE_RADIUS_DEG) return { region: "centre", distanceDeg, bearingDeg };
  const limit = mode === "classical" ? CLASSICAL_RADIUS_DEG : GLOBAL_RADIUS_DEG;
  if (distanceDeg > limit) return { region: null, distanceDeg, bearingDeg };
  const sector = Math.round(bearingDeg / 45) % 8;
  return { region: KOORMA_WEDGES[sector] as KoormaRegionId, distanceDeg, bearingDeg };
}

/** Glow strengths (DESIGN.md): 3 eclipse, 2 station or retrograde malefic, 1 transit, 0 none. */
export type GlowStrength = 0 | 1 | 2 | 3;

/** The physical malefics that the glow follows when retrograde. */
export type RetrogradeMalefic = "mars" | "saturn";
/** The grahas whose transit gives the soft glow (DESIGN.md). */
export type TransitGraha = "saturn" | "mars" | "rahu" | "ketu";
export type StationGraha = "mars" | "mercury" | "jupiter" | "venus" | "saturn";

export type GlowReason =
  | { kind: "eclipse"; eclipse: "solar" | "lunar"; type: string; nakshatra: number; timeMs: number }
  | { kind: "station"; graha: StationGraha; turns: "retrograde" | "direct"; nakshatra: number; timeMs: number }
  | { kind: "retrograde"; graha: RetrogradeMalefic; nakshatra: number }
  | { kind: "transit"; graha: TransitGraha; nakshatra: number };

export const REASON_STRENGTH: Readonly<Record<GlowReason["kind"], GlowStrength>> = {
  eclipse: 3,
  station: 2,
  retrograde: 2,
  transit: 1,
};

/** An eclipse lights its region from 7 days before to 7 days after (the window of the eclipse pins). */
export const ECLIPSE_GLOW_WINDOW_MS = 7 * 86_400_000;
/** A station lights its region from 3 days before to 3 days after. */
export const STATION_GLOW_WINDOW_MS = 3 * 86_400_000;

const STATION_GRAHAS: readonly GrahaId[] = ["mars", "mercury", "jupiter", "venus", "saturn"];
const RETROGRADE_MALEFICS: readonly GrahaId[] = ["mars", "saturn"];
const TRANSIT_GRAHAS: readonly GrahaId[] = ["saturn", "mars", "rahu", "ketu"];

export interface GlowInput {
  instantMs: number;
  grahas: readonly { id: GrahaId; siderealLongitudeDeg: number; retrograde: boolean }[];
  eclipses: readonly { kind: "solar" | "lunar"; type: string; timeMs: number; nakshatra: number }[];
  stations: readonly { graha: GrahaId; timeMs: number; turns: "retrograde" | "direct"; longitudeDeg: number }[];
}

export interface RegionGlow {
  region: KoormaRegion;
  strength: GlowStrength;
  /** Strongest first. */
  reasons: GlowReason[];
}

/**
 * The glow of each division at an instant (DESIGN.md, Koorma glow):
 * - 3: an eclipse in one of the region's nakshatras, within 7 days. Penumbral
 *   lunar eclipses do not count, because the eye cannot see them.
 * - 2: a station of Mars, Mercury, Jupiter, Venus or Saturn within 3 days, at
 *   a longitude in the region's nakshatras; or Mars or Saturn retrograde there.
 * - 1: Saturn, Mars, Rahu or Ketu in one of the region's nakshatras.
 * One graha gives one reason: a station before retrograde motion, and
 * retrograde motion before a plain transit.
 */
export function koormaGlow(input: GlowInput): RegionGlow[] {
  const reasons: GlowReason[] = [];
  for (const eclipse of input.eclipses) {
    if (eclipse.kind === "lunar" && eclipse.type === "penumbral") continue;
    if (Math.abs(eclipse.timeMs - input.instantMs) > ECLIPSE_GLOW_WINDOW_MS) continue;
    reasons.push({ kind: "eclipse", eclipse: eclipse.kind, type: eclipse.type, nakshatra: eclipse.nakshatra, timeMs: eclipse.timeMs });
  }
  const explained = new Set<GrahaId>();
  for (const station of input.stations) {
    if (!STATION_GRAHAS.includes(station.graha)) continue;
    if (Math.abs(station.timeMs - input.instantMs) > STATION_GLOW_WINDOW_MS) continue;
    if (explained.has(station.graha)) continue;
    explained.add(station.graha);
    reasons.push({
      kind: "station",
      graha: station.graha as StationGraha,
      turns: station.turns,
      nakshatra: getNakshatra(station.longitudeDeg).index,
      timeMs: station.timeMs,
    });
  }
  for (const graha of input.grahas) {
    if (explained.has(graha.id)) continue;
    const nakshatra = getNakshatra(graha.siderealLongitudeDeg).index;
    if (RETROGRADE_MALEFICS.includes(graha.id) && graha.retrograde) {
      reasons.push({ kind: "retrograde", graha: graha.id as RetrogradeMalefic, nakshatra });
    } else if (TRANSIT_GRAHAS.includes(graha.id)) {
      reasons.push({ kind: "transit", graha: graha.id as TransitGraha, nakshatra });
    }
  }

  return KOORMA_REGIONS.map((region) => {
    const own = reasons
      .filter((reason) => region.nakshatras.includes(reason.nakshatra))
      .sort((a, b) => REASON_STRENGTH[b.kind] - REASON_STRENGTH[a.kind]);
    const strength = own.reduce<GlowStrength>((max, reason) => Math.max(max, REASON_STRENGTH[reason.kind]) as GlowStrength, 0);
    return { region, strength, reasons: own };
  });
}

/** The strongest glow of each lit nakshatra, for the arcs on the ring. */
export function litNakshatras(glow: readonly RegionGlow[]): Map<number, GlowStrength> {
  const lit = new Map<number, GlowStrength>();
  for (const region of glow) {
    for (const reason of region.reasons) {
      const strength = REASON_STRENGTH[reason.kind];
      if (strength > (lit.get(reason.nakshatra) ?? 0)) lit.set(reason.nakshatra, strength);
    }
  }
  return lit;
}
