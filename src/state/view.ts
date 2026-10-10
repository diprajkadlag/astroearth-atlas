import type { KoormaMode } from "../engine/koorma.ts";
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
export type { KoormaMode };
/** Lanes: one graha per lane. Cycles: the cosine of the angle between 2 grahas. */
export type TimelineView = "lanes" | "cycles";

/** Pairs offered in the Cycles view (plan, M4). At most 4 show at once. */
export const CYCLE_PAIRS = [
  "jupiter-saturn",
  "saturn-rahu",
  "jupiter-rahu",
  "mars-saturn",
  "mars-jupiter",
  "sun-saturn",
  "sun-moon",
] as const;
export type CyclePair = (typeof CYCLE_PAIRS)[number];
export const MAX_CYCLE_PAIRS = 4;

export function pairGrahas(pair: CyclePair): [LaneId, LaneId] {
  const [a, b] = pair.split("-") as [LaneId, LaneId];
  return [a, b];
}

/** The settings that a share link holds. Nothing else goes into the link. */
export interface ViewSettings {
  instantMs: number;
  span: Span;
  lanes: LaneId[];
  koorma: KoormaMode;
  view: TimelineView;
  pairs: CyclePair[];
  /** The world event whose card is open, or null. */
  eventId: string | null;
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
    view: "lanes",
    pairs: ["jupiter-saturn"],
    eventId: null,
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

const EVENT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The hash of a share link, for example
 * "#d=2020-12-21&from=2014-12-21&to=2026-12-21&lanes=sa,ju&koorma=global&view=lanes&pairs=jupiter-saturn".
 */
export function serializeView(view: ViewSettings): string {
  const params = new URLSearchParams();
  params.set("d", formatUrlInstant(view.instantMs));
  params.set("from", formatUrlInstant(view.span.startMs));
  params.set("to", formatUrlInstant(view.span.endMs));
  params.set("lanes", view.lanes.map((lane) => LANE_CODES[lane]).join(","));
  params.set("koorma", view.koorma);
  params.set("view", view.view);
  params.set("pairs", view.pairs.join(","));
  if (view.eventId) params.set("event", view.eventId);
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

  const viewParam = params.get("view");
  const view: TimelineView = viewParam === "lanes" || viewParam === "cycles" ? viewParam : fallback.view;

  const pairCodes = (params.get("pairs") ?? "").split(",");
  const pairs = CYCLE_PAIRS.filter((pair) => pairCodes.includes(pair)).slice(0, MAX_CYCLE_PAIRS);

  const eventParam = params.get("event");
  const eventId = eventParam && EVENT_ID.test(eventParam) ? eventParam : params.has("d") ? null : fallback.eventId;

  return {
    instantMs,
    span,
    lanes: lanes.length > 0 ? lanes : [...fallback.lanes],
    koorma,
    view,
    pairs: pairs.length > 0 ? pairs : [...fallback.pairs],
    eventId,
  };
}
