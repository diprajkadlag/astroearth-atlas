import { useMemo, useState } from "react";

import { SKY_MOMENTS } from "../data/presets.ts";
import { useSkyEvents } from "../data/skyEventsLoader.ts";
import { findTimelineEvent, nakshatraName, timelineEvents, type TimelineEvent } from "../data/timelineEvents.ts";
import { EVENT_CATEGORIES, eventDayMs, type EventCategory, type WorldEvent } from "../data/worldEvents.ts";
import { siderealLongitude } from "../engine/positions.ts";
import { zodiacPlacement } from "../engine/zodiac.ts";
import { categoryLabel, eventTitle, kindLabel } from "../i18n/events.ts";
import { formatDate, formatDateTime, formatDegrees, formatUtcTime } from "../i18n/format.ts";
import { t } from "../i18n/index.ts";
import { useAtlas } from "../state/store.ts";

const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });

function placementText(longitudeDeg: number): string {
  const placement = zodiacPlacement(longitudeDeg);
  return t("moonPlacement", {
    sign: placement.sign.name,
    degree: formatDegrees(placement.sign.degreeDeg),
    nakshatra: placement.nakshatra.name,
  });
}

function latLon(latitudeDeg: number, longitudeDeg: number): string {
  const lat = `${Math.abs(latitudeDeg).toFixed(2)}° ${latitudeDeg >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(longitudeDeg).toFixed(2)}° ${longitudeDeg >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}

/** The date line of a world event, in the precision of its source. */
function worldDate(world: WorldEvent, timeMs: number): string {
  if (world.precision === "minute") return formatDateTime(timeMs);
  if (world.precision === "month") return MONTH_YEAR.format(Date.parse(`${world.start}-01T00:00:00Z`));
  const [year, month, day] = world.start.split("-").map(Number) as [number, number, number];
  const date = formatDate(Date.UTC(year, month - 1, day));
  return world.place
    ? `${date}. ${t("shownAtLocalNoon", { time: formatUtcTime(timeMs) })}`
    : `${date}. ${t("shownAtNoonUtc")}`;
}

function EventCard({ event, onClose }: { event: TimelineEvent; onClose: () => void }) {
  const world = event.world;
  const day = world ? eventDayMs(world) : null;
  const moonRange = day
    ? t("moonRange", {
        from: placementText(siderealLongitude("moon", new Date(day.startMs))),
        to: placementText(siderealLongitude("moon", new Date(day.endMs))),
      })
    : null;

  return (
    <article aria-labelledby="event-card-title" className="border-t-2 border-brass pt-3" data-testid="event-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-muted text-small">
            {kindLabel(event.kind)}
            {world ? `, ${categoryLabel(world.category)}` : ""}
          </p>
          <h3 id="event-card-title" className="mt-1 font-display text-title-2">
            {eventTitle(event)}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 shrink-0 rounded-control border border-rule-strong px-3 text-small hover:border-ivory sm:min-h-10"
        >
          {t("eventClose")}
        </button>
      </div>
      <p className="mt-2 tabular-nums">{world ? worldDate(world, event.timeMs) : formatDateTime(event.timeMs)}</p>
      {world?.place ? <p className="text-muted mt-1 text-small">{world.place.name}</p> : null}
      {world ? <p className="mt-3 max-w-prose">{world.summary}</p> : null}
      {event.eclipse ? (
        <div className="mt-3 max-w-prose space-y-1">
          <p>
            {t(event.eclipse.kind === "solar" ? "eclipseSunIn" : "eclipseMoonIn", {
              nakshatra: nakshatraName(event.eclipse.nakshatra),
            })}
          </p>
          <p className="text-muted text-small">
            {event.eclipse.kind === "lunar"
              ? t("eclipseSubLunar", { place: latLon(event.eclipse.latitudeDeg, event.eclipse.longitudeDeg) })
              : event.eclipse.centralLine
                ? t("eclipseCentralPeak", { place: latLon(event.eclipse.latitudeDeg, event.eclipse.longitudeDeg) })
                : t("eclipseNoCentralLine", { place: latLon(event.eclipse.latitudeDeg, event.eclipse.longitudeDeg) })}
          </p>
        </div>
      ) : null}
      {event.conjunction ? (
        <p className="mt-3 max-w-prose">
          {t("greatConjunctionAt", {
            degree: formatDegrees(event.conjunction.siderealDeg % 30),
            sign: event.conjunction.siderealSign,
          })}
        </p>
      ) : null}
      {moonRange ? <p className="text-muted mt-3 max-w-prose text-small">{moonRange}</p> : null}
      {world ? (
        <p className="mt-3 text-small">
          <a href={`https://www.wikidata.org/wiki/${world.wikidata}`} target="_blank" rel="noopener noreferrer">
            {t("eventSource", { id: world.wikidata })}
          </a>
        </p>
      ) : (
        <p className="text-muted mt-3 text-small">{t("eventCalculated")}</p>
      )}
    </article>
  );
}

/** The selected event, the sky moments and the list of world events. */
export function EventsPanel({ className = "" }: { className?: string }) {
  const eventId = useAtlas((state) => state.eventId);
  const selectEvent = useAtlas((state) => state.selectEvent);
  const jumpTo = useAtlas((state) => state.jumpTo);
  const sky = useSkyEvents();
  const events = useMemo(() => timelineEvents(sky), [sky]);
  const selected = findTimelineEvent(events, eventId);
  const [category, setCategory] = useState<EventCategory | "all">("all");
  const world = events.filter((event) => event.world && (category === "all" || event.world.category === category));

  return (
    <section aria-labelledby="events-title" className={`grid min-w-0 gap-x-8 gap-y-6 lg:grid-cols-[3fr_2fr] ${className}`}>
      <div className="min-w-0">
        {selected ? (
          <EventCard event={selected} onClose={() => selectEvent(null)} />
        ) : (
          <p className="text-muted border-t border-rule pt-3 text-small">{t("eventNone")}</p>
        )}
      </div>
      <div className="min-w-0">
        <h2 id="events-title" className="font-display text-title-2">
          {t("eventsTitle")}
        </h2>
        <h3 className="mt-3 text-small font-semibold">{t("momentsTitle")}</h3>
        <ul className="mt-1 flex flex-wrap gap-2">
          {SKY_MOMENTS.map((moment) => (
            <li key={moment.id}>
              <button
                type="button"
                onClick={() => jumpTo(moment.instantMs, { exact: true, eventId: null })}
                className="min-h-11 rounded-control border border-rule-strong px-3 py-1 text-left text-small leading-tight hover:border-ivory"
              >
                {t(moment.title)}
                <span className="text-muted block text-caption">{formatDate(moment.instantMs)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-small font-semibold">{t("worldEventsTitle")}</h3>
          <label className="flex items-center gap-2 text-small">
            {t("categoryFilter")}
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as EventCategory | "all")}
              className="min-h-10 rounded-control border border-rule-strong bg-ground px-2"
            >
              <option value="all">{t("categoryAll")}</option>
              {EVENT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {categoryLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <ul className="mt-2 max-h-96 overflow-y-auto border-t border-rule" data-testid="world-events">
          {world.map((event) => (
            <li key={event.id} className="border-b border-rule">
              <button
                type="button"
                aria-current={event.id === eventId ? "true" : undefined}
                onClick={() => jumpTo(event.timeMs, { exact: true, eventId: event.id })}
                className={`grid w-full grid-cols-[64px_minmax(0,1fr)] gap-3 py-2 text-left text-small hover:bg-raised ${
                  event.id === eventId ? "bg-raised" : ""
                }`}
              >
                <span className="text-muted tabular-nums">{new Date(event.timeMs).getUTCFullYear()}</span>
                <span>{eventTitle(event)}</span>
              </button>
            </li>
          ))}
          {world.length === 0 ? <li className="text-muted py-2 text-small">{t("worldEventsEmpty")}</li> : null}
        </ul>
      </div>
    </section>
  );
}
