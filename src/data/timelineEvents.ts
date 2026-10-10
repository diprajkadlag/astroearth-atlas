import { NAKSHATRAS } from "../engine/zodiac.ts";
import { firstAtOrAfter, type Eclipse, type GreatConjunction, type SkyEvents } from "./skyEvents.ts";
import { WORLD_EVENTS, eventInstantMs, type WorldEvent } from "./worldEvents.ts";

/**
 * One list of the marks on the timeline: world events, eclipses and the
 * conjunctions of Jupiter and Saturn. The ids are stable, so a share link can
 * open an event: world events keep their own id, sky events take their date.
 */

export type TimelineEventKind = "world" | "solar-eclipse" | "lunar-eclipse" | "great-conjunction";

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  timeMs: number;
  /** True when the time is a stated or calculated instant, not a day. */
  exact: boolean;
  world?: WorldEvent;
  eclipse?: Eclipse;
  conjunction?: GreatConjunction;
}

function dayId(prefix: string, ms: number): string {
  return `${prefix}-${new Date(ms).toISOString().slice(0, 10)}`;
}

/** "great-conjunction-2020-12-21": the timeline id of a conjunction of Jupiter and Saturn. */
export function greatConjunctionId(ms: number): string {
  return dayId("great-conjunction", ms);
}

let cache: { events: SkyEvents | null; list: TimelineEvent[] } | null = null;

/** All timeline events, sorted by time. World events show before the sky data loads. */
export function timelineEvents(sky: SkyEvents | null): TimelineEvent[] {
  if (cache && cache.events === sky) return cache.list;
  const list: TimelineEvent[] = WORLD_EVENTS.map((world) => ({
    id: world.id,
    kind: "world",
    timeMs: eventInstantMs(world),
    exact: world.precision === "minute",
    world,
  }));
  if (sky) {
    for (const eclipse of sky.eclipses) {
      list.push({
        id: dayId(eclipse.kind === "solar" ? "solar-eclipse" : "lunar-eclipse", eclipse.timeMs),
        kind: eclipse.kind === "solar" ? "solar-eclipse" : "lunar-eclipse",
        timeMs: eclipse.timeMs,
        exact: true,
        eclipse,
      });
    }
    for (const conjunction of sky.greatConjunctions) {
      list.push({
        id: greatConjunctionId(conjunction.timeMs),
        kind: "great-conjunction",
        timeMs: conjunction.timeMs,
        exact: true,
        conjunction,
      });
    }
  }
  list.sort((a, b) => a.timeMs - b.timeMs);
  cache = { events: sky, list };
  return list;
}

export function findTimelineEvent(list: readonly TimelineEvent[], id: string | null): TimelineEvent | null {
  return id ? (list.find((event) => event.id === id) ?? null) : null;
}

/** The nearest event strictly before or after `ms`, for the Previous and Next buttons. */
export function neighbourEvent(list: readonly TimelineEvent[], ms: number, direction: -1 | 1): TimelineEvent | null {
  if (direction === 1) {
    // Skip events within a minute of the date: the current event.
    const index = firstAtOrAfter(list, ms + 60_000);
    return list[index] ?? null;
  }
  const index = firstAtOrAfter(list, ms - 60_000) - 1;
  return index >= 0 ? (list[index] ?? null) : null;
}

/** Name of the nakshatra with this index. */
export function nakshatraName(index: number): string {
  return NAKSHATRAS[Math.min(26, Math.max(0, index))] ?? "";
}
