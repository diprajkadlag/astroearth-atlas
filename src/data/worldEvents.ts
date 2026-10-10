/**
 * Curated world events (plan, event data). Rules:
 * - Titles are neutral and in own words. Summaries are own words, at most
 *   160 characters. No Wikipedia text (CC BY-SA). Facts and Wikidata IDs only.
 * - Selection: major events with a clear start date, global plus key Indian
 *   events. No event is added or removed because of the sky at its date.
 * - Each fact was checked against Wikidata on 2026-10-10.
 * tests/worldEvents.test.ts checks the schema of every entry.
 */

export type EventCategory = "health" | "conflict" | "disaster" | "politics" | "science";
export type DatePrecision = "month" | "day" | "minute";

export interface EventPlace {
  /** A neutral place name. */
  name: string;
  latitudeDeg: number;
  longitudeDeg: number;
}

export interface WorldEvent {
  /** Kebab case, ending in the year: "covid-pandemic-2020". */
  id: string;
  title: string;
  /** "1918-03" (month), "1947-08-15" (day, the local date) or "1969-07-20T20:17Z" (minute, UTC). */
  start: string;
  precision: DatePrecision;
  category: EventCategory;
  place?: EventPlace;
  summary: string;
  /** Wikidata item, "Q" and digits. */
  wikidata: string;
}

export const EVENT_CATEGORIES: readonly EventCategory[] = ["health", "conflict", "disaster", "politics", "science"];

const HOUR_MS = 3_600_000;

/**
 * The instant at which the app shows an event (plan, event time rule):
 * - minute precision: the stated UTC time;
 * - day precision: 12:00 local mean time at the place (4 minutes per degree
 *   east of Greenwich), or 12:00 UTC without a place;
 * - month precision: 12:00 UTC on the 1st of the month.
 */
export function eventInstantMs(event: Pick<WorldEvent, "start" | "precision" | "place">): number {
  if (event.precision === "minute") return Date.parse(event.start);
  const [year, month, day = 1] = event.start.split("-").map(Number) as [number, number, number?];
  const noonUtc = Date.UTC(year, month - 1, day, 12);
  if (event.precision === "month" || !event.place) return noonUtc;
  return noonUtc - (event.place.longitudeDeg / 15) * HOUR_MS;
}

/**
 * The local day of a day-precision event, as UTC milliseconds of its start
 * and end: the shown instant (local noon) minus and plus 12 hours.
 */
export function eventDayMs(event: Pick<WorldEvent, "start" | "precision" | "place">): { startMs: number; endMs: number } | null {
  if (event.precision !== "day") return null;
  const noon = eventInstantMs(event);
  return { startMs: noon - 12 * HOUR_MS, endMs: noon + 12 * HOUR_MS };
}

/** Filled in from the checked list (see the fact check of 2026-10-10). */
export const WORLD_EVENTS: readonly WorldEvent[] = [];
