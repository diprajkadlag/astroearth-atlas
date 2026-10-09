/** Formats for dates and angles. The range of the app (1900 to 2050) is all Gregorian. */

const DATE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  month: "short",
  year: "numeric",
});

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});

/** "21 December 2020" */
export function formatDate(ms: number): string {
  return DATE.format(ms);
}

/** "18:26 UTC" */
export function formatUtcTime(ms: number): string {
  return `${TIME.format(ms)} UTC`;
}

/** "21 December 2020, 18:26 UTC" */
export function formatDateTime(ms: number): string {
  return `${formatDate(ms)}, ${formatUtcTime(ms)}`;
}

/** "Dec 2020", for axis labels. */
export function formatMonthYear(ms: number): string {
  return MONTH_YEAR.format(ms);
}

/** "21 Dec", for axis labels. */
export function formatDayMonth(ms: number): string {
  return DAY_MONTH.format(ms);
}

/** "6°18′": whole degrees and arcminutes, rounded to the arcminute. */
export function formatDegrees(value: number): string {
  let degrees = Math.floor(value);
  let minutes = Math.round((value - degrees) * 60);
  if (minutes === 60) {
    degrees += 1;
    minutes = 0;
  }
  return `${degrees}°${String(minutes).padStart(2, "0")}′`;
}
