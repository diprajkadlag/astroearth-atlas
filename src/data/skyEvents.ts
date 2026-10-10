import type { GrahaId, PhysicalGrahaId } from "../engine/zodiac.ts";

/**
 * The precomputed sky events (public/data, made by scripts/generate-sky-data.ts):
 * stations, conjunctions, eclipses, Kala Sarpa windows and the great
 * conjunctions. They load once, after the page, from the app's own origin.
 */

export interface Station {
  graha: PhysicalGrahaId;
  timeMs: number;
  turns: "retrograde" | "direct";
  longitudeDeg: number;
}

export interface PairConjunction {
  a: GrahaId;
  b: GrahaId;
  timeMs: number;
  longitudeDeg: number;
}

export interface Eclipse {
  kind: "solar" | "lunar";
  type: string;
  timeMs: number;
  /** Peak of the central line, the sub-solar point (partial solar) or the sub-lunar point. */
  latitudeDeg: number;
  longitudeDeg: number;
  centralLine: boolean;
  /** Sidereal longitude of the Sun (solar) or the Moon (lunar) at peak. */
  siderealDeg: number;
  nakshatra: number;
}

export interface KalaSarpaWindow {
  startMs: number;
  endMs: number;
  side: "rahu-to-ketu" | "ketu-to-rahu";
}

export interface GreatConjunction {
  timeMs: number;
  siderealDeg: number;
  siderealSign: string;
  approximate: boolean;
}

export interface SkyEvents {
  stations: Station[];
  conjunctions: PairConjunction[];
  eclipses: Eclipse[];
  kalaSarpa: KalaSarpaWindow[];
  greatConjunctions: GreatConjunction[];
}

interface RawEvents {
  stations: { graha: PhysicalGrahaId; time: string; turns: "retrograde" | "direct"; longitude: number }[];
  conjunctions: { a: GrahaId; b: GrahaId; time: string; longitude: number }[];
  solarEclipses: { time: string; type: string; centralLine: boolean; lat: number; lon: number; longitude: number; nakshatra: number }[];
  lunarEclipses: { time: string; type: string; lat: number; lon: number; longitude: number; nakshatra: number }[];
  kalaSarpa: { start: string; end: string; side: "rahu-to-ketu" | "ketu-to-rahu" }[];
}

interface RawGreat {
  conjunctions: { time: string; siderealLongitude: number; siderealSign: string; approximate: boolean }[];
}

/** Parses the generator's minute-precision ISO strings, for example "1900-03-15T13:27Z". */
export function parseEventTime(text: string): number {
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) throw new RangeError(`Bad event time: ${text}`);
  return ms;
}

export function parseSkyEvents(raw: RawEvents, great: RawGreat): SkyEvents {
  const byTime = <T extends { timeMs: number }>(items: T[]) => items.sort((a, b) => a.timeMs - b.timeMs);
  return {
    stations: byTime(
      raw.stations.map((s) => ({ graha: s.graha, timeMs: parseEventTime(s.time), turns: s.turns, longitudeDeg: s.longitude })),
    ),
    conjunctions: byTime(
      raw.conjunctions.map((c) => ({ a: c.a, b: c.b, timeMs: parseEventTime(c.time), longitudeDeg: c.longitude })),
    ),
    eclipses: byTime([
      ...raw.solarEclipses.map((e) => ({
        kind: "solar" as const,
        type: e.type,
        timeMs: parseEventTime(e.time),
        latitudeDeg: e.lat,
        longitudeDeg: e.lon,
        centralLine: e.centralLine,
        siderealDeg: e.longitude,
        nakshatra: e.nakshatra,
      })),
      ...raw.lunarEclipses.map((e) => ({
        kind: "lunar" as const,
        type: e.type,
        timeMs: parseEventTime(e.time),
        latitudeDeg: e.lat,
        longitudeDeg: e.lon,
        centralLine: false,
        siderealDeg: e.longitude,
        nakshatra: e.nakshatra,
      })),
    ]),
    kalaSarpa: raw.kalaSarpa
      .map((w) => ({ startMs: parseEventTime(w.start), endMs: parseEventTime(w.end), side: w.side }))
      .sort((a, b) => a.startMs - b.startMs),
    greatConjunctions: byTime(
      great.conjunctions.map((g) => ({
        timeMs: parseEventTime(g.time),
        siderealDeg: g.siderealLongitude,
        siderealSign: g.siderealSign,
        approximate: g.approximate,
      })),
    ),
  };
}

/** Index of the first item with timeMs >= ms (binary search on a sorted list). */
export function firstAtOrAfter<T extends { timeMs: number }>(items: readonly T[], ms: number): number {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((items[middle] as T).timeMs < ms) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Items with timeMs in [startMs, endMs]. */
export function between<T extends { timeMs: number }>(items: readonly T[], startMs: number, endMs: number): T[] {
  const result: T[] = [];
  for (let index = firstAtOrAfter(items, startMs); index < items.length; index += 1) {
    const item = items[index] as T;
    if (item.timeMs > endMs) break;
    result.push(item);
  }
  return result;
}
