import type { GrahaId } from "./zodiac.ts";

/** Manifest written next to public/data/sky-daily-1900-2050.bin. */
export interface DailyTableManifest {
  file: string;
  start: string;
  stepDays: number;
  days: number;
  series: GrahaId[];
}

const DAY_MS = 86_400_000;

/**
 * Reads the precomputed daily sidereal longitudes (00:00 UTC, 1900 to 2050).
 * Values are little-endian Uint16 steps of 360/65536 degrees, series-major.
 */
export class DailyTable {
  readonly startMs: number;
  readonly days: number;
  private readonly view: DataView;
  private readonly seriesIndex: ReadonlyMap<GrahaId, number>;

  constructor(manifest: DailyTableManifest, buffer: ArrayBuffer) {
    if (manifest.stepDays !== 1) throw new RangeError("The daily table must have a step of 1 day.");
    const expectedBytes = manifest.days * manifest.series.length * 2;
    if (buffer.byteLength !== expectedBytes) {
      throw new RangeError(`The daily table has ${buffer.byteLength} bytes, expected ${expectedBytes}.`);
    }
    this.startMs = Date.parse(manifest.start);
    this.days = manifest.days;
    this.view = new DataView(buffer);
    this.seriesIndex = new Map(manifest.series.map((id, index) => [id, index]));
  }

  has(id: GrahaId): boolean {
    return id === "ketu" ? this.seriesIndex.has("rahu") : this.seriesIndex.has(id);
  }

  get endMs(): number {
    return this.startMs + (this.days - 1) * DAY_MS;
  }

  /** Sidereal longitude on day `day` (0 = first day) at 00:00 UTC. */
  longitude(id: GrahaId, day: number): number {
    const source = id === "ketu" ? "rahu" : id;
    const series = this.seriesIndex.get(source);
    if (series === undefined) throw new RangeError(`The daily table has no series for ${id}.`);
    if (!Number.isInteger(day) || day < 0 || day >= this.days) {
      throw new RangeError(`Day ${day} is outside the daily table.`);
    }
    const degrees = (this.view.getUint16((series * this.days + day) * 2, true) * 360) / 65_536;
    return id === "ketu" ? (degrees + 180) % 360 : degrees;
  }

  /** Day indices whose 00:00 UTC lies in [startMs, endMs]. */
  dayRange(startMs: number, endMs: number): { first: number; last: number } {
    const first = Math.max(0, Math.ceil((startMs - this.startMs) / DAY_MS));
    const last = Math.min(this.days - 1, Math.floor((endMs - this.startMs) / DAY_MS));
    return { first, last };
  }

  timeOfDay(day: number): number {
    return this.startMs + day * DAY_MS;
  }
}
