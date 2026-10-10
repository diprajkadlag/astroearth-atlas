import type { TimelineEvent, TimelineEventKind } from "../data/timelineEvents.ts";
import type { EventCategory } from "../data/worldEvents.ts";
import { t } from "./index.ts";

const ECLIPSE_TITLES: Readonly<Record<string, Parameters<typeof t>[0]>> = {
  "solar-total": "eclipseSolarTotal",
  "solar-annular": "eclipseSolarAnnular",
  "solar-partial": "eclipseSolarPartial",
  "solar-hybrid": "eclipseSolarHybrid",
  "lunar-total": "eclipseLunarTotal",
  "lunar-partial": "eclipseLunarPartial",
  "lunar-penumbral": "eclipseLunarPenumbral",
};

/** The title of a timeline event, in plain words. */
export function eventTitle(event: TimelineEvent): string {
  if (event.world) return event.world.title;
  if (event.eclipse) {
    const key = ECLIPSE_TITLES[`${event.eclipse.kind}-${event.eclipse.type}`];
    return key ? t(key) : t(event.eclipse.kind === "solar" ? "eclipseSolarPartial" : "eclipseLunarPartial");
  }
  if (event.conjunction) return t("greatConjunctionTitle", { sign: event.conjunction.siderealSign });
  return "";
}

const CATEGORY_KEYS: Readonly<Record<EventCategory, Parameters<typeof t>[0]>> = {
  health: "categoryHealth",
  conflict: "categoryConflict",
  disaster: "categoryDisaster",
  politics: "categoryPolitics",
  science: "categoryScience",
};

export function categoryLabel(category: EventCategory): string {
  return t(CATEGORY_KEYS[category]);
}

const KIND_KEYS: Readonly<Record<TimelineEventKind, Parameters<typeof t>[0]>> = {
  world: "kindWorld",
  "solar-eclipse": "kindSolarEclipse",
  "lunar-eclipse": "kindLunarEclipse",
  "great-conjunction": "kindGreatConjunction",
};

export function kindLabel(kind: TimelineEventKind): string {
  return t(KIND_KEYS[kind]);
}
