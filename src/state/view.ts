import type { GrahaId } from "../engine/zodiac.ts";
import {
  DAY_MS,
  DEFAULT_SPAN_MS,
  MAX_INSTANT_MS,
  MIN_INSTANT_MS,
  MIN_SPAN_MS,
  clampInstant,
  spanAround,
  startOfUtcDay,
  type Span,
} from "./dates.ts";

/** A timeline lane. The Rahu lane shows Rahu and Ketu together. */
export type LaneId = Exclude<GrahaId, "ketu">;
export type KoormaMode = "global" | "classical";

/** The settings that a share link holds. Nothing else goes into the link. */
export interface ViewSettings {
  instantMs: number;
  span: Span;
  lanes: LaneId[];
  koorma: KoormaMode;
}

/** DESIGN.md: desktop shows 5 lanes, phones the first 3. */
export const DEFAULT_LANES: readonly LaneId[] = ["saturn", "jupiter", "rahu", "mars", "sun"];
export const ALL_LANES: readonly LaneId[] = [
  "saturn",
  "jupiter",
  "rahu",
  "mars",
  "sun",
  "venus",
  "mercury",
  "moon",
];

const LANE_CODES: Readonly<Record<LaneId, string>> = {
  saturn: "sa",
  jupiter: "ju",
  rahu: "ra",
  mars: "ma",
  sun: "su",
  venus: "ve",
  mercury: "me",
  moon: "mo",
};

/** DESIGN.md: the app opens on today at 00:00 UTC, unless the link holds a date. */
export function defaultView(nowMs: number = Date.now()): ViewSettings {
  const instantMs = clampInstant(startOfUtcDay(nowMs));
  return {
    instantMs,
    span: spanAround(instantMs, DEFAULT_SPAN_MS),
    lanes: [...DEFAULT_LANES],
    koorma: "global",
  };
}

function formatUrlInstant(ms: number): string {
  const iso = new Date(ms).toISOString();
  return ms % DAY_MS === 0 ? iso.slice(0, 10) : `${iso.slice(0, 16)}Z`;
}

const URL_INSTANT = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})Z)?$/;

/** Parses "2020-12-21" or "2020-12-21T18:26Z". Returns null for anything else. */
export function parseUrlInstant(text: string | null): number | null {
  const match = text ? URL_INSTANT.exec(text) : null;
  if (!match) return null;
  const [, year, month, day, hour = "0", minute = "0"] = match;
  const ms = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  const date = new Date(ms);
  // Reject dates that Date.UTC rolls over, such as 2021-02-30.
  if (date.getUTCDate() !== Number(day) || date.getUTCMonth() !== Number(month) - 1) return null;
  if (ms < MIN_INSTANT_MS || ms > MAX_INSTANT_MS) return null;
  return ms;
}

/** The hash of a share link, for example "#d=2020-12-21&from=2014-12-21&to=2026-12-21&lanes=sa,ju&koorma=global". */
export function serializeView(view: ViewSettings): string {
  const params = new URLSearchParams();
  params.set("d", formatUrlInstant(view.instantMs));
  params.set("from", formatUrlInstant(view.span.startMs));
  params.set("to", formatUrlInstant(view.span.endMs));
  params.set("lanes", view.lanes.map((lane) => LANE_CODES[lane]).join(","));
  params.set("koorma", view.koorma);
  // Keep the commas readable.
  return `#${params.toString().replaceAll("%2C", ",")}`;
}

/**
 * Reads a share-link hash. Each setting that is missing or invalid keeps its
 * value from `fallback`, so a broken link still opens the app.
 */
export function parseView(hash: string, fallback: ViewSettings): ViewSettings {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const instantMs = parseUrlInstant(params.get("d")) ?? fallback.instantMs;

  let span = fallback.span;
  const from = parseUrlInstant(params.get("from"));
  const to = parseUrlInstant(params.get("to"));
  if (from !== null && to !== null && to - from >= MIN_SPAN_MS) {
    span = { startMs: from, endMs: to };
  } else if (params.has("d")) {
    // A link with only a date opens the default span around that date.
    span = spanAround(instantMs, fallback.span.endMs - fallback.span.startMs);
  }
  if (instantMs < span.startMs || instantMs > span.endMs) {
    span = spanAround(instantMs, span.endMs - span.startMs);
  }

  const codes = (params.get("lanes") ?? "").split(",");
  const lanes = ALL_LANES.filter((lane) => codes.includes(LANE_CODES[lane]));
  // Keep the order of the link.
  lanes.sort((a, b) => codes.indexOf(LANE_CODES[a]) - codes.indexOf(LANE_CODES[b]));

  const koormaParam = params.get("koorma");
  const koorma: KoormaMode =
    koormaParam === "global" || koormaParam === "classical" ? koormaParam : fallback.koorma;

  return {
    instantMs,
    span,
    lanes: lanes.length > 0 ? lanes : [...fallback.lanes],
    koorma,
  };
}
