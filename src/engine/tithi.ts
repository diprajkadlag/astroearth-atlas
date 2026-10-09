import { normalizeDegrees } from "./angles.ts";

/** Names of tithis 1 to 14 of each paksha. Tithi 15 is Purnima, tithi 30 Amavasya. */
export const TITHI_NAMES = [
  "Pratipada",
  "Dvitiya",
  "Tritiya",
  "Chaturthi",
  "Panchami",
  "Shashthi",
  "Saptami",
  "Ashtami",
  "Navami",
  "Dashami",
  "Ekadashi",
  "Dvadashi",
  "Trayodashi",
  "Chaturdashi",
] as const;

export type Paksha = "shukla" | "krishna";

export interface Tithi {
  /** 1 to 30, counted from the new Moon. */
  number: number;
  paksha: Paksha;
  /** For example "Shukla Navami", "Purnima" or "Amavasya". */
  name: string;
  /** Moon minus Sun in longitude, [0, 360). */
  elongationDeg: number;
}

/**
 * The lunar day at one instant: each tithi spans 12 degrees of the Moon's
 * elongation from the Sun. The elongation is the same in the tropical and the
 * sidereal zodiac.
 */
export function tithiFromLongitudes(sunDeg: number, moonDeg: number): Tithi {
  const elongationDeg = normalizeDegrees(moonDeg - sunDeg);
  const number = Math.min(30, Math.floor(elongationDeg / 12) + 1);
  const paksha: Paksha = number <= 15 ? "shukla" : "krishna";
  let name: string;
  if (number === 15) name = "Purnima";
  else if (number === 30) name = "Amavasya";
  else name = `${paksha === "shukla" ? "Shukla" : "Krishna"} ${TITHI_NAMES[(number - 1) % 15]}`;
  return { number, paksha, name, elongationDeg };
}
