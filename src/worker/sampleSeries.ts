import type { DailyTable } from "../engine/dailyTable.ts";
import { siderealLongitude } from "../engine/positions.ts";
import {
  decimateMinMax,
  packPieces,
  unwrapDegrees,
  wrapPolyline,
  type Point,
} from "../engine/sampling.ts";
import type { GrahaId } from "../engine/zodiac.ts";
import type { SampleRequest, SampleResponse, SeriesSamples } from "./protocol.ts";

const DAY_MS = 86_400_000;
/** Computed samples per pixel column, when the daily table cannot serve. */
const SAMPLES_PER_COLUMN = 2;
/** The daily table serves spans of at least 3 days. Lines join the daily points. */
const MIN_TABLE_SPAN_MS = 3 * DAY_MS;

/**
 * Builds the drawable series for one request. The daily table serves the
 * grahas that it holds; the engine computes the rest (the Moon) and very short
 * spans. Dense data keeps the min and max of each pixel column. Sparse data
 * keeps every point plus one on each side, so the line reaches both edges.
 * This is a pure function, so unit tests can run it without a worker.
 */
export function sampleSeries(request: SampleRequest, table: DailyTable | null): SampleResponse {
  const columns = Math.max(1, Math.floor(request.columns));
  const span = request.endMs - request.startMs;
  if (!(span > 0)) throw new RangeError("The sample span must be positive.");

  const series: SeriesSamples[] = request.ids.map((id) => {
    const useTable =
      table !== null &&
      table.has(id) &&
      span >= MIN_TABLE_SPAN_MS &&
      request.startMs >= table.startMs &&
      request.endMs <= table.endMs;
    const { xs, ys } = useTable
      ? fromTable(table, id, request.startMs, request.endMs)
      : computed(id, request.startMs, request.endMs, columns * SAMPLES_PER_COLUMN);
    const unwrapped = unwrapDegrees(ys);
    const points =
      xs.length > 2 * columns
        ? decimateMinMax(xs, unwrapped, request.startMs, request.endMs, columns)
        : toPoints(xs, unwrapped);
    return {
      id,
      packed: packPieces(wrapPolyline(points)),
      source: useTable ? "daily-table" : "computed",
    };
  });

  return { type: "samples", requestId: request.requestId, series };
}

function toPoints(xs: Float64Array, ys: Float64Array): Point[] {
  return Array.from(xs, (x, index) => ({ x, y: ys[index] as number }));
}

function fromTable(table: DailyTable, id: GrahaId, startMs: number, endMs: number) {
  const range = table.dayRange(startMs, endMs);
  const first = Math.max(0, range.first - 1);
  const last = Math.min(table.days - 1, range.last + 1);
  const count = Math.max(0, last - first + 1);
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    xs[index] = table.timeOfDay(first + index);
    ys[index] = table.longitude(id, first + index);
  }
  return { xs, ys };
}

function computed(id: GrahaId, startMs: number, endMs: number, samples: number) {
  const step = (endMs - startMs) / samples;
  // One extra sample on each side, so the line reaches both edges.
  const xs = new Float64Array(samples + 3);
  const ys = new Float64Array(samples + 3);
  for (let index = 0; index < samples + 3; index += 1) {
    const ms = startMs + (index - 1) * step;
    xs[index] = ms;
    ys[index] = siderealLongitude(id, new Date(ms));
  }
  return { xs, ys };
}
