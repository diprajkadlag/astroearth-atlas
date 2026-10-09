import { MakeTime, type AstroTime } from "astronomy-engine";

/** An absolute instant: a JavaScript Date (UTC inside) or an astronomy-engine time. */
export type Instant = Date | AstroTime;

export const DAY_MS = 86_400_000;

export function assertValidDate(date: Date): void {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError("instant must be a valid Date that represents an absolute time.");
  }
}

export function toAstroTime(instant: Instant): AstroTime {
  if (instant instanceof Date) {
    assertValidDate(instant);
    return MakeTime(instant);
  }
  return instant;
}

/** Julian centuries of Terrestrial Time since J2000.0 (2000-01-01 12:00 TT). */
export function centuriesTT(time: AstroTime): number {
  return time.tt / 36_525;
}

/** ISO string at minute precision, the format of the generated event files. */
export function toIsoMinute(time: AstroTime): string {
  const date = new Date(Math.round(time.date.getTime() / 60_000) * 60_000);
  return `${date.toISOString().slice(0, 16)}Z`;
}
