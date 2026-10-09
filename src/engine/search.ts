import { MakeTime, type AstroTime } from "astronomy-engine";

import { normalizeDegrees, signedAngularDelta } from "./angles.ts";
import { longitudeSpeed, siderealLongitude, type PositionOptions } from "./positions.ts";
import type { KalaSarpaSide } from "./rules.ts";
import { toAstroTime, type Instant } from "./time.ts";
import {
  NAKSHATRA_SIZE_DEG,
  RASI_SIZE_DEG,
  type GrahaId,
  type PhysicalGrahaId,
} from "./zodiac.ts";

/** Searches refine every event instant to 1 minute. */
export const MINUTE_DAYS = 1 / 1440;

export type Division = "sign" | "nakshatra";

/** Sidereal longitude of a graha at an instant. A caching sampler speeds up long searches. */
export type LongitudeSampler = (id: GrahaId, time: AstroTime) => number;

export interface SearchOptions extends PositionOptions {
  /** Must use the same node model as `nodeModel`. */
  sampler?: LongitudeSampler;
}

export interface IngressEvent {
  kind: "ingress";
  graha: GrahaId;
  division: Division;
  time: AstroTime;
  /** Sign index (0-11) or nakshatra index (0-26) before and after the crossing. */
  from: number;
  to: number;
  retrograde: boolean;
}

export interface StationEvent {
  kind: "station";
  graha: GrahaId;
  time: AstroTime;
  /** The direction of motion after the station. */
  turns: "retrograde" | "direct";
  siderealLongitudeDeg: number;
}

export interface ConjunctionEvent {
  kind: "conjunction";
  a: GrahaId;
  b: GrahaId;
  time: AstroTime;
  /** Sidereal longitude of `a` at the instant (equal to that of `b`). */
  siderealLongitudeDeg: number;
}

export interface KalaSarpaWindow {
  kind: "kala-sarpa";
  start: AstroTime;
  end: AstroTime;
  side: KalaSarpaSide;
}

function samplerOf(options: SearchOptions): LongitudeSampler {
  return options.sampler ?? ((id, time) => siderealLongitude(id, time, options));
}

/** Refines a sign change of `f` between `a` and `b` by bisection. */
export function bisect(
  f: (time: AstroTime) => number,
  a: AstroTime,
  b: AstroTime,
  toleranceDays = MINUTE_DAYS,
): AstroTime {
  let low = a;
  let high = b;
  let fLow = f(low);
  while (high.ut - low.ut > toleranceDays) {
    const middle = low.AddDays((high.ut - low.ut) / 2);
    const fMiddle = f(middle);
    if (fMiddle !== 0 && Math.sign(fMiddle) === Math.sign(fLow)) {
      low = middle;
      fLow = fMiddle;
    } else {
      high = middle;
    }
  }
  return low.AddDays((high.ut - low.ut) / 2);
}

/** Finds the edge where `inside` turns from true (at `a`) to false (at `b`). */
function bisectEdge(
  inside: (time: AstroTime) => boolean,
  a: AstroTime,
  b: AstroTime,
  toleranceDays: number,
): AstroTime {
  let low = a;
  let high = b;
  while (high.ut - low.ut > toleranceDays) {
    const middle = low.AddDays((high.ut - low.ut) / 2);
    if (inside(middle)) low = middle;
    else high = middle;
  }
  return low.AddDays((high.ut - low.ut) / 2);
}

/** Yields the instants of [start, end] at `stepDays` spacing. The last step stops at `end`. */
function* steps(start: Instant, end: Instant, stepDays: number): Generator<AstroTime> {
  const first = toAstroTime(start);
  const last = toAstroTime(end);
  const count = Math.ceil((last.ut - first.ut) / stepDays);
  for (let index = 0; index <= count; index += 1) {
    yield MakeTime(Math.min(first.ut + index * stepDays, last.ut));
  }
}

/** Sign or nakshatra ingresses of one graha, including retrograde re-entries. */
export function findIngresses(
  id: GrahaId,
  division: Division,
  start: Instant,
  end: Instant,
  stepDays: number,
  options: SearchOptions = {},
): IngressEvent[] {
  const sample = samplerOf(options);
  const size = division === "sign" ? RASI_SIZE_DEG : NAKSHATRA_SIZE_DEG;
  const count = division === "sign" ? 12 : 27;
  const segmentOf = (longitude: number) => Math.floor(longitude / size) % count;

  const events: IngressEvent[] = [];
  let previous: { time: AstroTime; longitude: number; segment: number } | null = null;
  for (const time of steps(start, end, stepDays)) {
    const longitude = sample(id, time);
    const segment = segmentOf(longitude);
    if (previous && segment !== previous.segment) {
      const forward = signedAngularDelta(previous.longitude, longitude) > 0;
      const boundary = normalizeDegrees((forward ? segment : previous.segment) * size);
      events.push({
        kind: "ingress",
        graha: id,
        division,
        time: bisect(
          (t) => signedAngularDelta(boundary, siderealLongitude(id, t, options)),
          previous.time,
          time,
        ),
        from: previous.segment,
        to: segment,
        retrograde: !forward,
      });
    }
    previous = { time, longitude, segment };
  }
  return events;
}

/** Instants where a graha's longitude speed changes sign. */
export function findStations(
  id: PhysicalGrahaId,
  start: Instant,
  end: Instant,
  stepDays = 1,
  options: SearchOptions = {},
): StationEvent[] {
  const sample = samplerOf(options);
  // The scan uses a coarse speed from the samples one step before and after,
  // so that a caching sampler serves it. The refinement then uses a ±1 hour
  // difference, which puts the station within minutes of zero speed.
  const coarseSpeed = (time: AstroTime) =>
    signedAngularDelta(sample(id, time.AddDays(-stepDays)), sample(id, time.AddDays(stepDays)));
  const preciseSpeed = (time: AstroTime) => longitudeSpeed(id, time, options, 1 / 24);

  const events: StationEvent[] = [];
  let previous: { time: AstroTime; speed: number } | null = null;
  for (const time of steps(start, end, stepDays)) {
    const speed = coarseSpeed(time);
    if (previous && speed !== 0 && Math.sign(speed) !== Math.sign(previous.speed)) {
      const from = previous.time.AddDays(-stepDays);
      const to = time.AddDays(stepDays);
      if (Math.sign(preciseSpeed(from)) !== Math.sign(preciseSpeed(to))) {
        const instant = bisect(preciseSpeed, from, to);
        events.push({
          kind: "station",
          graha: id,
          time: instant,
          turns: previous.speed > 0 ? "retrograde" : "direct",
          siderealLongitudeDeg: siderealLongitude(id, instant, options),
        });
      }
    }
    previous = { time, speed };
  }
  return events;
}

/** Instants where 2 grahas have the same sidereal longitude. */
export function findConjunctions(
  a: GrahaId,
  b: GrahaId,
  start: Instant,
  end: Instant,
  stepDays: number,
  options: SearchOptions = {},
): ConjunctionEvent[] {
  const sample = samplerOf(options);
  const exactGap = (time: AstroTime) =>
    signedAngularDelta(siderealLongitude(b, time, options), siderealLongitude(a, time, options));

  const events: ConjunctionEvent[] = [];
  let previous: { time: AstroTime; gap: number } | null = null;
  for (const time of steps(start, end, stepDays)) {
    const gap = signedAngularDelta(sample(b, time), sample(a, time));
    // A sign change near ±180 degrees is an opposition, not a conjunction.
    const crossesZero =
      previous !== null &&
      Math.sign(gap) !== Math.sign(previous.gap) &&
      Math.abs(gap) < 90 &&
      Math.abs(previous.gap) < 90;
    if (previous && crossesZero) {
      const instant = bisect(exactGap, previous.time, time);
      events.push({
        kind: "conjunction",
        a,
        b,
        time: instant,
        siderealLongitudeDeg: siderealLongitude(a, instant, options),
      });
    }
    previous = { time, gap };
  }
  return events;
}

/**
 * A sampler that caches positions on the 00:00 UTC grid, where long searches
 * sample the same instants again and again. Other instants are computed.
 */
export function cachingSampler(options: PositionOptions = {}): LongitudeSampler {
  const cache = new Map<string, number>();
  return (id, time) => {
    // ut counts days from 2000-01-01 12:00 UTC, so midnight has a fraction of 0.5.
    const day = time.ut + 0.5;
    const rounded = Math.round(day);
    if (Math.abs(day - rounded) > 1e-7) return siderealLongitude(id, time, options);
    const key = `${id}@${rounded}`;
    let value = cache.get(key);
    if (value === undefined) {
      value = siderealLongitude(id, time, options);
      cache.set(key, value);
    }
    return value;
  };
}

/** The 6 physical grahas other than the Moon, slowest first. */
const SLOW_GRAHAS: readonly PhysicalGrahaId[] = ["saturn", "jupiter", "mars", "sun", "venus", "mercury"];
const KALA_SARPA_ORDER: readonly PhysicalGrahaId[] = [...SLOW_GRAHAS, "moon"];

/**
 * No graha moves more than about 2.3 degrees per day relative to Rahu
 * (Mercury at its fastest), so a graha that is further than this margin on
 * the wrong side at the start of a day stays there for the whole day.
 */
const DAILY_MARGIN_DEG = 3;

function sideOfAxis(relativeDeg: number): KalaSarpaSide | null {
  if (relativeDeg > 0 && relativeDeg < 180) return "rahu-to-ketu";
  if (relativeDeg > 180 && relativeDeg < 360) return "ketu-to-rahu";
  return null;
}

/** Kala Sarpa windows (Moon included), with edges refined to 1 hour. */
export function findKalaSarpaWindows(
  start: Instant,
  end: Instant,
  stepDays = 0.25,
  options: SearchOptions = {},
): KalaSarpaWindow[] {
  const sample = samplerOf(options);
  const sideAt = (time: AstroTime): KalaSarpaSide | null => {
    const rahu = siderealLongitude("rahu", time, options);
    let side: KalaSarpaSide | null | undefined;
    for (const id of KALA_SARPA_ORDER) {
      const here = sideOfAxis(normalizeDegrees(siderealLongitude(id, time, options) - rahu));
      if (here === null || (side !== undefined && here !== side)) return null;
      side = here;
    }
    return side ?? null;
  };

  /**
   * False when slow grahas sit clearly on both sides at the start of the day.
   * They cannot cross the axis within the day, so the whole day is free.
   */
  const dayCanHoldWindow = (dayStart: AstroTime): boolean => {
    const rahu = sample("rahu", dayStart);
    let clearlyAfterRahu = false;
    let clearlyAfterKetu = false;
    for (const id of SLOW_GRAHAS) {
      const relative = normalizeDegrees(sample(id, dayStart) - rahu);
      if (relative > DAILY_MARGIN_DEG && relative < 180 - DAILY_MARGIN_DEG) clearlyAfterRahu = true;
      if (relative > 180 + DAILY_MARGIN_DEG && relative < 360 - DAILY_MARGIN_DEG) clearlyAfterKetu = true;
      if (clearlyAfterRahu && clearlyAfterKetu) return false;
    }
    return true;
  };

  const windows: KalaSarpaWindow[] = [];
  const first = toAstroTime(start);
  const last = toAstroTime(end);
  let previous: { time: AstroTime; side: KalaSarpaSide | null } | null = null;
  let openedAt: AstroTime | null = null;

  const visit = (time: AstroTime, side: KalaSarpaSide | null) => {
    if (!previous) {
      if (side) openedAt = time;
    } else if (side !== previous.side) {
      const before = previous.side;
      const edge = bisectEdge((t) => sideAt(t) === before, previous.time, time, 1 / 24);
      if (before && openedAt) windows.push({ kind: "kala-sarpa", start: openedAt, end: edge, side: before });
      openedAt = side ? edge : null;
    }
    previous = { time, side };
  };

  for (let dayStart = first; dayStart.ut < last.ut; dayStart = dayStart.AddDays(1)) {
    const dayEnd = MakeTime(Math.min(dayStart.ut + 1, last.ut));
    if (!dayCanHoldWindow(dayStart)) {
      // The side at dayStart is null, so any open window closed before it.
      previous = { time: dayEnd, side: null };
      continue;
    }
    for (let offset = 0; offset < 1 - 1e-9; offset += stepDays) {
      const time = dayStart.AddDays(offset);
      if (time.ut > last.ut) break;
      visit(time, sideAt(time));
    }
    visit(dayEnd, sideAt(dayEnd));
  }
  if (previous?.side && openedAt) {
    windows.push({ kind: "kala-sarpa", start: openedAt, end: previous.time, side: previous.side });
  }
  return windows;
}
