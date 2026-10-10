import { DEG } from "../engine/angles.ts";
import type { DailyTable } from "../engine/dailyTable.ts";
import { siderealLongitude } from "../engine/positions.ts";
import { decimateMinMax, packPieces, type Point } from "../engine/sampling.ts";
import type { GrahaId } from "../engine/zodiac.ts";
import type { CycleRequest, CycleResponse, CycleSeries } from "./protocol.ts";

const DAY_MS = 86_400_000;
const SAMPLES_PER_COLUMN = 2;
const MIN_TABLE_SPAN_MS = 3 * DAY_MS;

/**
 * The Cycles view (plan, M4): for a pair of grahas, the cosine of the angle
 * between them. It is a true wave: +1 at a conjunction, 0 at a square, -1 at
 * an opposition. The cosine has no wrap at 360 degrees, so each pair is one
 * unbroken line. Dense data keeps the min and max of each pixel column, so
 * no conjunction peak is lost. A pure function, tested without a worker.
 */
export function sampleCycles(request: CycleRequest, table: DailyTable | null): CycleResponse {
  const columns = Math.max(1, Math.floor(request.columns));
  const span = request.endMs - request.startMs;
  if (!(span > 0)) throw new RangeError("The sample span must be positive.");

  const series: CycleSeries[] = request.pairs.map(([a, b]) => {
    const useTable =
      table !== null &&
      table.has(a) &&
      table.has(b) &&
      span >= MIN_TABLE_SPAN_MS &&
      request.startMs >= table.startMs &&
      request.endMs <= table.endMs;
    const { xs, ys } = useTable
      ? fromTable(table, a, b, request.startMs, request.endMs)
      : computed(a, b, request.startMs, request.endMs, columns * SAMPLES_PER_COLUMN);
    const points: Point[] =
      xs.length > 2 * columns
        ? decimateMinMax(xs, ys, request.startMs, request.endMs, columns)
        : Array.from(xs, (x, index) => ({ x, y: ys[index] as number }));
    return { pair: `${a}-${b}`, packed: packPieces([points]) };
  });

  return { type: "cycles", requestId: request.requestId, series };
}

function cosine(a: number, b: number): number {
  return Math.cos((a - b) * DEG);
}

function fromTable(table: DailyTable, a: GrahaId, b: GrahaId, startMs: number, endMs: number) {
  const range = table.dayRange(startMs, endMs);
  const first = Math.max(0, range.first - 1);
  const last = Math.min(table.days - 1, range.last + 1);
  const count = Math.max(0, last - first + 1);
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);
  for (let index = 0; index < count; index += 1) {
    xs[index] = table.timeOfDay(first + index);
    ys[index] = cosine(table.longitude(a, first + index), table.longitude(b, first + index));
  }
  return { xs, ys };
}

function computed(a: GrahaId, b: GrahaId, startMs: number, endMs: number, samples: number) {
  const step = (endMs - startMs) / samples;
  const xs = new Float64Array(samples + 3);
  const ys = new Float64Array(samples + 3);
  for (let index = 0; index < samples + 3; index += 1) {
    const ms = startMs + (index - 1) * step;
    const date = new Date(ms);
    xs[index] = ms;
    ys[index] = cosine(siderealLongitude(a, date), siderealLongitude(b, date));
  }
  return { xs, ys };
}
