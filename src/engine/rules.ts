import { angularSeparation, normalizeDegrees } from "./angles.ts";
import type { GrahaPosition } from "./positions.ts";
import { PHYSICAL_GRAHA_IDS, type GrahaId } from "./zodiac.ts";

/**
 * Houses that each graha aspects (graha drishti), counted inclusively from its
 * own sign: 1 is its own sign, 7 the opposite sign. Aspects are sign-based, as
 * in Parashari practice. Rahu and Ketu cast no aspects in this app, because
 * the traditions disagree (the Method page says so).
 */
export const GRAHA_DRISHTI: Readonly<Record<GrahaId, readonly number[]>> = {
  sun: [7],
  moon: [7],
  mercury: [7],
  venus: [7],
  mars: [4, 7, 8],
  jupiter: [5, 7, 9],
  saturn: [3, 7, 10],
  rahu: [],
  ketu: [],
};

/** The 5 "star" grahas that can be in planetary war (graha yuddha). */
const TARA_GRAHAS: readonly GrahaId[] = ["mars", "mercury", "jupiter", "venus", "saturn"];

/**
 * Combustion (asta) orbs: distance from the Sun, in degrees. Source: Surya
 * Siddhanta 9.6-9.8 and 10.1 (Burgess translation, 1860, public domain):
 * Jupiter 11, Saturn 15, Mars 17, Moon 12; Venus 8 near inferior conjunction
 * (retrograde) and 10 otherwise; Mercury 12 when retrograde and 14 otherwise.
 * The text gives "degrees of time" (oblique ascension) for visibility. Like
 * most Jyotish software, this app applies them as distances in longitude.
 */
export const COMBUSTION_ORBS_DEG: Readonly<Partial<Record<GrahaId, number>>> = {
  moon: 12,
  mars: 17,
  mercury: 14,
  jupiter: 11,
  venus: 10,
  saturn: 15,
};
export const COMBUSTION_ORBS_RETROGRADE_DEG: Readonly<Partial<Record<GrahaId, number>>> = {
  mercury: 12,
  venus: 8,
};

export interface Aspect {
  from: GrahaId;
  to: GrahaId;
  /** House of `to`, counted from `from`. */
  house: number;
}

export interface PairContact {
  a: GrahaId;
  b: GrahaId;
  separationDeg: number;
  sameSign: boolean;
}

export interface Combustion {
  id: GrahaId;
  separationDeg: number;
  orbDeg: number;
}

export type KalaSarpaSide = "rahu-to-ketu" | "ketu-to-rahu";

export interface KalaSarpaState {
  active: boolean;
  side: KalaSarpaSide | null;
}

function byId(grahas: readonly GrahaPosition[], id: GrahaId): GrahaPosition {
  const graha = grahas.find((candidate) => candidate.id === id);
  if (!graha) throw new RangeError(`The sky has no position for ${id}.`);
  return graha;
}

/** Sign-based aspects between all grahas. */
export function aspects(grahas: readonly GrahaPosition[]): Aspect[] {
  const result: Aspect[] = [];
  for (const from of grahas) {
    for (const to of grahas) {
      if (from.id === to.id) continue;
      const house = ((to.sign.index - from.sign.index + 12) % 12) + 1;
      if (GRAHA_DRISHTI[from.id].includes(house)) {
        result.push({ from: from.id, to: to.id, house });
      }
    }
  }
  return result;
}

/** Pairs within `orbDeg` of each other (yuti). The Rahu-Ketu pair is never a conjunction. */
export function conjunctions(
  grahas: readonly GrahaPosition[],
  orbDeg = 10,
): PairContact[] {
  const result: PairContact[] = [];
  grahas.forEach((a, index) => {
    for (const b of grahas.slice(index + 1)) {
      const isNodePair =
        (a.id === "rahu" && b.id === "ketu") || (a.id === "ketu" && b.id === "rahu");
      if (isNodePair) continue;
      const separationDeg = angularSeparation(a.siderealLongitudeDeg, b.siderealLongitudeDeg);
      if (separationDeg <= orbDeg) {
        result.push({ a: a.id, b: b.id, separationDeg, sameSign: a.sign.index === b.sign.index });
      }
    }
  });
  return result;
}

/** Planetary war: 2 of Mars, Mercury, Jupiter, Venus and Saturn within 1 degree. */
export function grahaYuddha(grahas: readonly GrahaPosition[]): PairContact[] {
  return conjunctions(
    grahas.filter((graha) => TARA_GRAHAS.includes(graha.id)),
    1,
  );
}

/** Grahas within their combustion orb of the Sun. */
export function combustion(grahas: readonly GrahaPosition[]): Combustion[] {
  const sun = byId(grahas, "sun");
  const result: Combustion[] = [];
  for (const graha of grahas) {
    const normalOrb = COMBUSTION_ORBS_DEG[graha.id];
    if (normalOrb === undefined) continue;
    const orbDeg = graha.retrograde
      ? (COMBUSTION_ORBS_RETROGRADE_DEG[graha.id] ?? normalOrb)
      : normalOrb;
    const separationDeg = angularSeparation(graha.siderealLongitudeDeg, sun.siderealLongitudeDeg);
    if (separationDeg <= orbDeg) result.push({ id: graha.id, separationDeg, orbDeg });
  }
  return result;
}

/**
 * Kala Sarpa: all 7 physical grahas (Moon included) on one side of the
 * Rahu-Ketu axis. The side tells whether they follow Rahu or Ketu in zodiac
 * order. A graha exactly on the axis breaks the pattern.
 */
export function kalaSarpa(grahas: readonly GrahaPosition[]): KalaSarpaState {
  const rahu = byId(grahas, "rahu").siderealLongitudeDeg;
  const relative = PHYSICAL_GRAHA_IDS.map((id) =>
    normalizeDegrees(byId(grahas, id).siderealLongitudeDeg - rahu),
  );
  if (relative.every((value) => value > 0 && value < 180)) {
    return { active: true, side: "rahu-to-ketu" };
  }
  if (relative.every((value) => value > 180 && value < 360)) {
    return { active: true, side: "ketu-to-rahu" };
  }
  return { active: false, side: null };
}
