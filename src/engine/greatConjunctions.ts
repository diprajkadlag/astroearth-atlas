import type { AstroTime } from "astronomy-engine";

import { lahiriAyanamsa } from "./ayanamsa.ts";
import { eclipticPosition } from "./positions.ts";
import { findConjunctions } from "./search.ts";
import type { Instant } from "./time.ts";
import { elementOfSign, getRasi, type Element, type RasiPlacement } from "./zodiac.ts";

/**
 * astronomy-engine documents its 1-arcminute accuracy for the modern era.
 * Conjunctions before this year are labelled approximate.
 */
export const APPROXIMATE_BEFORE_YEAR = 1700;

export interface GreatConjunction {
  time: AstroTime;
  tropicalLongitudeDeg: number;
  siderealLongitudeDeg: number;
  sidereal: RasiPlacement;
  tropicalSignIndex: number;
  tropicalElement: Element;
  /** Conjunctions of one retrograde loop (a triple conjunction) share a group. */
  group: number;
  approximate: boolean;
}

/**
 * Jupiter-Saturn conjunctions in geocentric ecliptic longitude. Lists that
 * use right ascension, or heliocentric mean motion, can differ by days.
 */
export function findGreatConjunctions(start: Instant, end: Instant): GreatConjunction[] {
  const events = findConjunctions("jupiter", "saturn", start, end, 5);
  let group = 0;
  let previousUt = Number.NEGATIVE_INFINITY;
  return events.map((event) => {
    if (event.time.ut - previousUt > 400) group += 1;
    previousUt = event.time.ut;
    const ayanamsa = lahiriAyanamsa(event.time);
    const position = eclipticPosition("jupiter", event.time, {}, ayanamsa);
    const tropicalSignIndex = Math.floor(position.tropicalLongitudeDeg / 30) % 12;
    return {
      time: event.time,
      tropicalLongitudeDeg: position.tropicalLongitudeDeg,
      siderealLongitudeDeg: position.siderealLongitudeDeg,
      sidereal: getRasi(position.siderealLongitudeDeg),
      tropicalSignIndex,
      tropicalElement: elementOfSign(tropicalSignIndex),
      group,
      approximate: event.time.date.getUTCFullYear() < APPROXIMATE_BEFORE_YEAR,
    };
  });
}
