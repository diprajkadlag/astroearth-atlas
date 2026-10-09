/**
 * Calendar labels for historical dates. JavaScript dates are proleptic
 * Gregorian. History books give dates before 15 October 1582 in the Julian
 * calendar, so the app shows those in the Julian calendar (for example the
 * 1345 great conjunction: 24 March 1345, Julian).
 */

const UNIX_EPOCH_JULIAN_DAY = 2_440_587.5;
/** Julian Day Number of 1582-10-15, the first day of the Gregorian calendar. */
const FIRST_GREGORIAN_JDN = 2_299_161;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type CalendarName = "julian" | "gregorian";

export interface CalendarDate {
  calendar: CalendarName;
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
}

/** Julian Day Number of the UTC calendar day that contains the instant. */
export function julianDayNumber(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000 + UNIX_EPOCH_JULIAN_DAY + 0.5);
}

/** Converts a Julian Day Number to a date in the Julian calendar. */
export function julianCalendarDate(jdn: number): CalendarDate {
  const c = jdn + 32_082;
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    calendar: "julian",
    day: e - Math.floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * Math.floor(m / 10),
    year: d - 4800 + Math.floor(m / 10),
  };
}

/** The calendar date that history books use for the instant (UTC day). */
export function historicalDate(date: Date): CalendarDate {
  const jdn = julianDayNumber(date);
  if (jdn < FIRST_GREGORIAN_JDN) return julianCalendarDate(jdn);
  return {
    calendar: "gregorian",
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/** For example "24 March 1345 (Julian)" or "21 December 2020". */
export function formatHistoricalDate(date: Date): string {
  const value = historicalDate(date);
  const label = `${value.day} ${MONTHS[value.month - 1]} ${value.year}`;
  return value.calendar === "julian" ? `${label} (Julian)` : label;
}
