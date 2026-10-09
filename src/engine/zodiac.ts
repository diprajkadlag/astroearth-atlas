import { normalizeDegrees } from "./angles.ts";

/** Sidereal signs (rashis) in zodiac order. Index 0 starts at sidereal 0 degrees. */
export const RASIS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

/** The 27 nakshatras, each 13°20′ wide, starting with Ashwini at sidereal 0 degrees. */
export const NAKSHATRAS = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishtha",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
] as const;

export const GRAHA_IDS = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "rahu",
  "ketu",
] as const;

/** The 7 grahas that are physical bodies (Rahu and Ketu are orbital nodes). */
export const PHYSICAL_GRAHA_IDS = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
] as const;

export const ELEMENTS = ["fire", "earth", "air", "water"] as const;

export type RasiName = (typeof RASIS)[number];
export type NakshatraName = (typeof NAKSHATRAS)[number];
export type GrahaId = (typeof GRAHA_IDS)[number];
export type PhysicalGrahaId = (typeof PHYSICAL_GRAHA_IDS)[number];
export type Element = (typeof ELEMENTS)[number];
export type Pada = 1 | 2 | 3 | 4;

export const RASI_SIZE_DEG = 30;
export const NAKSHATRA_SIZE_DEG = 360 / 27;
export const PADA_SIZE_DEG = NAKSHATRA_SIZE_DEG / 4;

/** Vimshottari lords repeat in this order from Ashwini. */
const NAKSHATRA_LORDS = [
  "ketu",
  "venus",
  "sun",
  "moon",
  "mars",
  "rahu",
  "jupiter",
  "saturn",
  "mercury",
] as const satisfies readonly GrahaId[];

export interface RasiPlacement {
  index: number;
  name: RasiName;
  element: Element;
  degreeDeg: number;
}

export interface NakshatraPlacement {
  index: number;
  name: NakshatraName;
  lord: GrahaId;
  pada: Pada;
  degreeDeg: number;
}

export interface ZodiacPlacement {
  siderealLongitudeDeg: number;
  sign: RasiPlacement;
  nakshatra: NakshatraPlacement;
  /** Degrees to the nearest sign boundary. Another ayanamsa can move a body this far. */
  signBoundaryDistanceDeg: number;
  /** Degrees to the nearest nakshatra boundary. */
  nakshatraBoundaryDistanceDeg: number;
}

/** Fire, earth, air and water repeat from Aries. */
export function elementOfSign(signIndex: number): Element {
  return ELEMENTS[((signIndex % 4) + 4) % 4] as Element;
}

export function getRasi(siderealLongitudeDeg: number): RasiPlacement {
  const longitude = normalizeDegrees(siderealLongitudeDeg);
  const index = Math.min(Math.floor(longitude / RASI_SIZE_DEG), RASIS.length - 1);
  return {
    index,
    name: RASIS[index] as RasiName,
    element: elementOfSign(index),
    degreeDeg: longitude - index * RASI_SIZE_DEG,
  };
}

const PADA_COUNT = 108;

export function getNakshatra(siderealLongitudeDeg: number): NakshatraPlacement {
  const longitude = normalizeDegrees(siderealLongitudeDeg);
  // Counting in padas avoids a subtraction that lands just below an exact
  // boundary: 180 degrees must be Chitra pada 3, the start of Libra.
  const padaIndex = Math.min(
    Math.floor((longitude * PADA_COUNT) / 360),
    PADA_COUNT - 1,
  );
  const index = Math.floor(padaIndex / 4);
  return {
    index,
    name: NAKSHATRAS[index] as NakshatraName,
    lord: NAKSHATRA_LORDS[index % NAKSHATRA_LORDS.length] as GrahaId,
    pada: ((padaIndex % 4) + 1) as Pada,
    degreeDeg: Math.max(0, longitude - index * NAKSHATRA_SIZE_DEG),
  };
}

function boundaryDistance(longitude: number, size: number): number {
  const inside = longitude % size;
  return Math.min(inside, size - inside);
}

export function zodiacPlacement(siderealLongitudeDeg: number): ZodiacPlacement {
  const longitude = normalizeDegrees(siderealLongitudeDeg);
  return {
    siderealLongitudeDeg: longitude,
    sign: getRasi(longitude),
    nakshatra: getNakshatra(longitude),
    signBoundaryDistanceDeg: boundaryDistance(longitude, RASI_SIZE_DEG),
    nakshatraBoundaryDistanceDeg: boundaryDistance(longitude, NAKSHATRA_SIZE_DEG),
  };
}

export function isPhysicalGraha(id: GrahaId): id is PhysicalGrahaId {
  return id !== "rahu" && id !== "ketu";
}
