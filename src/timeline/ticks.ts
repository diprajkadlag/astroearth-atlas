import { formatDayMonth, formatMonthYear } from "../i18n/format.ts";

/** Time axis ticks for any span from a few hours to 151 years. */

export interface AxisTick {
  ms: number;
  label: string | null;
  /** Year starts are drawn in bold (DESIGN.md, timeline). */
  strong: boolean;
}

type Unit = "hour" | "day" | "month" | "year";

interface Interval {
  unit: Unit;
  count: number;
  /** Rough length, used to pick an interval. */
  approxMs: number;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MONTH = 30.44 * DAY;
const YEAR = 365.25 * DAY;

const INTERVALS: readonly Interval[] = [
  { unit: "hour", count: 1, approxMs: HOUR },
  { unit: "hour", count: 3, approxMs: 3 * HOUR },
  { unit: "hour", count: 6, approxMs: 6 * HOUR },
  { unit: "hour", count: 12, approxMs: 12 * HOUR },
  { unit: "day", count: 1, approxMs: DAY },
  { unit: "day", count: 7, approxMs: 7 * DAY },
  { unit: "month", count: 1, approxMs: MONTH },
  { unit: "month", count: 3, approxMs: 3 * MONTH },
  { unit: "month", count: 6, approxMs: 6 * MONTH },
  { unit: "year", count: 1, approxMs: YEAR },
  { unit: "year", count: 2, approxMs: 2 * YEAR },
  { unit: "year", count: 5, approxMs: 5 * YEAR },
  { unit: "year", count: 10, approxMs: 10 * YEAR },
  { unit: "year", count: 25, approxMs: 25 * YEAR },
  { unit: "year", count: 50, approxMs: 50 * YEAR },
];

/** The first boundary of `interval` at or after `ms`, in UTC. */
function ceilTo(ms: number, interval: Interval): number {
  const date = new Date(ms);
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  switch (interval.unit) {
    case "hour": {
      const step = interval.count * HOUR;
      return Math.ceil(ms / step) * step;
    }
    case "day": {
      if (interval.count === 7) {
        // Weeks start on Monday.
        const day = Math.ceil(ms / DAY) * DAY;
        const weekday = (new Date(day).getUTCDay() + 6) % 7;
        return weekday === 0 ? day : day + (7 - weekday) * DAY;
      }
      return Math.ceil(ms / DAY) * DAY;
    }
    case "month": {
      let candidate = Date.UTC(y, m - (m % interval.count), 1);
      while (candidate < ms) {
        const d = new Date(candidate);
        candidate = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + interval.count, 1);
      }
      return candidate;
    }
    case "year": {
      let year = Math.ceil(y / interval.count) * interval.count;
      if (Date.UTC(year, 0, 1) < ms) year += interval.count;
      return Date.UTC(year, 0, 1);
    }
  }
}

function addInterval(ms: number, interval: Interval): number {
  const date = new Date(ms);
  switch (interval.unit) {
    case "hour":
      return ms + interval.count * HOUR;
    case "day":
      return ms + interval.count * DAY;
    case "month":
      return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + interval.count, 1);
    case "year":
      return Date.UTC(date.getUTCFullYear() + interval.count, 0, 1);
  }
}

function label(ms: number, interval: Interval): string {
  const date = new Date(ms);
  switch (interval.unit) {
    case "year":
      return String(date.getUTCFullYear());
    case "month":
      return date.getUTCMonth() === 0 ? String(date.getUTCFullYear()) : formatMonthYear(ms);
    case "day":
      return formatDayMonth(ms);
    case "hour":
      return date.getUTCHours() === 0 ? formatDayMonth(ms) : `${String(date.getUTCHours()).padStart(2, "0")}:00`;
  }
}

/**
 * Labelled ticks at least `minLabelPx` apart, plus unlabelled minor ticks one
 * interval finer.
 */
export function axisTicks(startMs: number, endMs: number, widthPx: number, minLabelPx = 84): AxisTick[] {
  const span = endMs - startMs;
  if (!(span > 0) || widthPx <= 0) return [];
  const msPerPx = span / widthPx;
  const majorIndex = INTERVALS.findIndex((interval) => interval.approxMs / msPerPx >= minLabelPx);
  const major = INTERVALS[majorIndex === -1 ? INTERVALS.length - 1 : majorIndex] as Interval;
  const minor = INTERVALS[Math.max(0, (majorIndex === -1 ? INTERVALS.length - 1 : majorIndex) - 1)] as Interval;

  const ticks = new Map<number, AxisTick>();
  if (minor !== major && minor.approxMs / msPerPx >= 6) {
    for (let ms = ceilTo(startMs, minor); ms <= endMs; ms = addInterval(ms, minor)) {
      ticks.set(ms, { ms, label: null, strong: false });
    }
  }
  for (let ms = ceilTo(startMs, major); ms <= endMs; ms = addInterval(ms, major)) {
    const date = new Date(ms);
    const yearStart = date.getUTCMonth() === 0 && date.getUTCDate() === 1 && date.getUTCHours() === 0;
    ticks.set(ms, { ms, label: label(ms, major), strong: yearStart });
  }
  return [...ticks.values()].sort((a, b) => a.ms - b.ms);
}
