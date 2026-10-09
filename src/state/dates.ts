import { DAY_MS } from "../engine/time.ts";

export { DAY_MS };
export const HOUR_MS = 3_600_000;
const YEAR_MS = 365.25 * DAY_MS;

/** The first and the last date of the app: the range of the daily sky table. */
export const MIN_INSTANT_MS = Date.UTC(1900, 0, 1);
export const MAX_INSTANT_MS = Date.UTC(2050, 11, 31);

/** Limits of the visible timeline span. */
export const MIN_SPAN_MS = 2 * DAY_MS;
export const MAX_SPAN_MS = MAX_INSTANT_MS - MIN_INSTANT_MS;
export const DEFAULT_SPAN_MS = 12 * YEAR_MS;

export interface Span {
  startMs: number;
  endMs: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampInstant(ms: number): number {
  return clamp(ms, MIN_INSTANT_MS, MAX_INSTANT_MS);
}

export function startOfUtcDay(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/** Rounds to the nearest 00:00 UTC. */
export function nearestUtcDay(ms: number): number {
  return Math.round(ms / DAY_MS) * DAY_MS;
}

/**
 * The step of the arrow keys for a visible span: about one pixel column on a
 * wide screen, rounded to a unit that people count in.
 */
export function stepForSpan(spanMs: number): number {
  if (spanMs >= 40 * YEAR_MS) return 30 * DAY_MS;
  if (spanMs >= 8 * YEAR_MS) return 7 * DAY_MS;
  if (spanMs >= 60 * DAY_MS) return DAY_MS;
  return HOUR_MS;
}

/** A span of `lengthMs` around `centerMs`, moved inside the app range. */
export function spanAround(centerMs: number, lengthMs: number): Span {
  const length = clamp(lengthMs, MIN_SPAN_MS, MAX_SPAN_MS);
  const startMs = clamp(centerMs - length / 2, MIN_INSTANT_MS, MAX_INSTANT_MS - length);
  return { startMs, endMs: startMs + length };
}

/** Moves a span inside the app range and keeps its length within the limits. */
export function clampSpan(span: Span): Span {
  const length = clamp(span.endMs - span.startMs, MIN_SPAN_MS, MAX_SPAN_MS);
  const startMs = clamp(span.startMs, MIN_INSTANT_MS, MAX_INSTANT_MS - length);
  return { startMs, endMs: startMs + length };
}

/**
 * Keeps `instantMs` in view. A date past the right edge starts a new page
 * with the date at 10 % from the left, so playback has room ahead. A date
 * past the left edge ends a new page with the date at 10 % from the right.
 */
export function followInstant(span: Span, instantMs: number): Span {
  if (instantMs >= span.startMs && instantMs <= span.endMs) return span;
  const length = span.endMs - span.startMs;
  const startMs =
    instantMs > span.endMs ? instantMs - 0.1 * length : instantMs - 0.9 * length;
  return clampSpan({ startMs, endMs: startMs + length });
}

/** Changes the span length by `factor` and keeps `anchorMs` at the same place on screen. */
export function zoomSpan(span: Span, factor: number, anchorMs: number): Span {
  const length = span.endMs - span.startMs;
  const nextLength = clamp(length * factor, MIN_SPAN_MS, MAX_SPAN_MS);
  const ratio = clamp((anchorMs - span.startMs) / length, 0, 1);
  const startMs = anchorMs - ratio * nextLength;
  return clampSpan({ startMs, endMs: startMs + nextLength });
}
