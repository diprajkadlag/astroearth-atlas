import { useMemo, useSyncExternalStore, type ReactNode } from "react";

import { useSkyEvents } from "../data/skyEventsLoader.ts";
import { neighbourEvent, timelineEvents, type TimelineEvent } from "../data/timelineEvents.ts";
import { GRAHA_COLOR_TOKENS, UI_COLORS } from "../design/palette.ts";
import { t } from "../i18n/index.ts";
import { clampInstant, startOfUtcDay } from "../state/dates.ts";
import { PLAY_SPEEDS, useAtlas, type PlaySpeed } from "../state/store.ts";
import { ALL_LANES, CYCLE_PAIRS, MAX_CYCLE_PAIRS, type CyclePair, type LaneId } from "../state/view.ts";
import { CyclesView } from "./CyclesView.tsx";
import { DateRuler } from "./DateRuler.tsx";
import { LanesView } from "./LanesView.tsx";
import { PAIR_DASHES, laneLabel, pairLabel } from "./names.ts";

const phoneQuery = "(max-width: 639px)";

function usePhone(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(phoneQuery);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(phoneQuery).matches,
    () => false,
  );
}

const buttonBase = "min-h-11 rounded-control px-3 text-small font-medium sm:min-h-10 sm:px-4";
const secondary = `${buttonBase} border border-rule-strong hover:border-ivory disabled:opacity-40 disabled:hover:border-rule-strong`;
const toggleOn = "border-ivory bg-ivory text-ground";

/** A small sample of a legend shape, drawn in SVG. */
function Swatch({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" width="18" height="14" viewBox="0 0 18 14" className="shrink-0">
      {children}
    </svg>
  );
}

function Legend({ cycles }: { cycles: boolean }) {
  const pairs = useAtlas((state) => state.pairs);
  const items: { key: string; swatch: ReactNode; label: string }[] = [
    {
      key: "solar",
      swatch: (
        <>
          <circle cx="9" cy="7" r="5" fill={UI_COLORS.eclipse} />
          <circle cx="11.75" cy="6" r="4.25" fill={UI_COLORS.ground} />
        </>
      ),
      label: t("kindSolarEclipse"),
    },
    {
      key: "lunar",
      swatch: <circle cx="9" cy="7" r="4.25" fill="none" stroke={UI_COLORS.eclipse} strokeWidth="1.5" />,
      label: t("kindLunarEclipse"),
    },
    { key: "world", swatch: <path d="M9 1 L15 7 L9 13 L3 7 Z" fill={UI_COLORS.ivory} />, label: t("kindWorld") },
    {
      key: "great",
      swatch: (
        <>
          <circle cx="6.75" cy="7" r="4" fill="none" stroke={UI_COLORS.ivory} strokeWidth="1.4" />
          <circle cx="11.25" cy="7" r="4" fill="none" stroke={UI_COLORS.ivory} strokeWidth="1.4" />
        </>
      ),
      label: t("kindGreatConjunction"),
    },
    {
      key: "kala",
      swatch: <rect x="1" y="6" width="16" height="3" fill={GRAHA_COLOR_TOKENS.nodes} opacity="0.55" />,
      label: t("legendKalaSarpa"),
    },
  ];
  if (!cycles) {
    items.push(
      { key: "station", swatch: <path d="M9 12 L4.5 3.5 L13.5 3.5 Z" fill={UI_COLORS.ivory} />, label: t("legendStation") },
      { key: "dot", swatch: <circle cx="9" cy="7" r="3.2" fill={UI_COLORS.ivory} />, label: t("legendConjunction") },
    );
  } else {
    pairs.forEach((pair, index) => {
      items.push({
        key: pair,
        swatch: (
          <line
            x1="1"
            y1="7"
            x2="17"
            y2="7"
            stroke={UI_COLORS.ivory}
            strokeWidth="1.6"
            strokeDasharray={(PAIR_DASHES[index] ?? []).join(" ")}
          />
        ),
        label: pairLabel(pair),
      });
    });
  }
  return (
    <ul className="text-muted mt-2 flex flex-wrap gap-x-5 gap-y-1 text-small" aria-label={t("legendTitle")}>
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-2">
          <Swatch>{item.swatch}</Swatch>
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function LaneChooser() {
  const lanes = useAtlas((state) => state.lanes);
  const setLanes = useAtlas((state) => state.setLanes);
  const toggle = (lane: LaneId) => {
    const next = lanes.includes(lane)
      ? lanes.filter((item) => item !== lane)
      : ALL_LANES.filter((item) => item === lane || lanes.includes(item));
    setLanes(next);
  };
  return (
    <details className="relative">
      <summary className={`${secondary} flex cursor-pointer list-none items-center`}>{t("lanesChoose")}</summary>
      <fieldset className="absolute z-20 mt-1 min-w-56 rounded-control border border-rule-strong bg-raised p-3">
        <legend className="sr-only">{t("lanesChoose")}</legend>
        {ALL_LANES.map((lane) => (
          <label key={lane} className="flex min-h-9 items-center gap-2 text-small">
            <input
              type="checkbox"
              checked={lanes.includes(lane)}
              disabled={lanes.length === 1 && lanes.includes(lane)}
              onChange={() => toggle(lane)}
              className="size-4 accent-brass"
            />
            {laneLabel(lane)}
          </label>
        ))}
        <p className="text-muted mt-1 max-w-56 text-caption">{t("lanesMoonNote")}</p>
      </fieldset>
    </details>
  );
}

function PairChooser() {
  const pairs = useAtlas((state) => state.pairs);
  const setPairs = useAtlas((state) => state.setPairs);
  const toggle = (pair: CyclePair) => {
    setPairs(pairs.includes(pair) ? pairs.filter((item) => item !== pair) : [...pairs, pair]);
  };
  return (
    <details className="relative">
      <summary className={`${secondary} flex cursor-pointer list-none items-center`}>{t("pairsChoose")}</summary>
      <fieldset className="absolute z-20 mt-1 min-w-60 rounded-control border border-rule-strong bg-raised p-3">
        <legend className="text-muted mb-1 text-caption">{t("pairsLimit", { count: MAX_CYCLE_PAIRS })}</legend>
        {CYCLE_PAIRS.map((pair) => {
          const checked = pairs.includes(pair);
          return (
            <label key={pair} className="flex min-h-9 items-center gap-2 text-small">
              <input
                type="checkbox"
                checked={checked}
                disabled={(checked && pairs.length === 1) || (!checked && pairs.length >= MAX_CYCLE_PAIRS)}
                onChange={() => toggle(pair)}
                className="size-4 accent-brass"
              />
              {pairLabel(pair)}
            </label>
          );
        })}
      </fieldset>
    </details>
  );
}

/** Play, speed, live, zoom, events, the date ruler and the views: one date drives them all. */
export function TimelineSection({ className = "" }: { className?: string }) {
  const playing = useAtlas((state) => state.playing);
  const live = useAtlas((state) => state.live);
  const speed = useAtlas((state) => state.speed);
  const view = useAtlas((state) => state.view);
  const instantMs = useAtlas((state) => state.instantMs);
  const togglePlaying = useAtlas((state) => state.togglePlaying);
  const setSpeed = useAtlas((state) => state.setSpeed);
  const setLive = useAtlas((state) => state.setLive);
  const setInstant = useAtlas((state) => state.setInstant);
  const setView = useAtlas((state) => state.setView);
  const zoom = useAtlas((state) => state.zoom);
  const jumpTo = useAtlas((state) => state.jumpTo);
  const phone = usePhone();
  const sky = useSkyEvents();
  const events = useMemo(() => timelineEvents(sky), [sky]);
  const previous = neighbourEvent(events, instantMs, -1);
  const next = neighbourEvent(events, instantMs, 1);
  const go = (event: TimelineEvent | null) => {
    if (event) jumpTo(event.timeMs, { exact: true, eventId: event.id });
  };

  return (
    <section aria-labelledby="timeline-title" className={`min-w-0 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <h2 id="timeline-title" className="w-full font-display text-title-2 sm:w-auto">
          {t("timelineTitle")}
        </h2>
        <div role="group" aria-label={t("viewChoice")} className="flex gap-1">
          {(["lanes", "cycles"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={`${secondary} ${view === option ? toggleOn : ""}`}
            >
              {option === "lanes" ? t("viewLanes") : t("viewCycles")}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={togglePlaying}
            className={`${buttonBase} min-w-24 bg-brass text-ground hover:bg-ivory`}
            data-testid="play"
          >
            {playing ? t("pause") : t("play")}
          </button>
          <label className="flex items-center gap-2 text-small">
            {t("speed")}
            <select
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value) as PlaySpeed)}
              className="min-h-11 rounded-control border border-rule-strong bg-ground px-2 sm:min-h-10"
            >
              {PLAY_SPEEDS.map((days) => (
                <option key={days} value={days}>
                  {days === 1 ? t("speedOptionOne") : t("speedOption", { days })}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            aria-pressed={live}
            onClick={() => setLive(!live)}
            className={`${secondary} ${live ? toggleOn : ""}`}
          >
            {t("live")}
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setInstant(clampInstant(startOfUtcDay(Date.now())))}
          className={secondary}
        >
          {t("today")}
        </button>
        <button type="button" onClick={() => zoom(2, useAtlas.getState().instantMs)} className={secondary}>
          {t("zoomOut")}
        </button>
        <button type="button" onClick={() => zoom(0.5, useAtlas.getState().instantMs)} className={secondary}>
          {t("zoomIn")}
        </button>
        <button type="button" onClick={() => go(previous)} disabled={!previous} className={secondary}>
          {t("previousEvent")}
        </button>
        <button type="button" onClick={() => go(next)} disabled={!next} className={secondary}>
          {t("nextEvent")}
        </button>
        {view === "lanes" ? <LaneChooser /> : <PairChooser />}
      </div>
      <div className="mt-3">
        <DateRuler />
      </div>
      <div className="mt-2">
        {view === "lanes" ? <LanesView height={phone ? 210 : 370} /> : <CyclesView height={phone ? 210 : 370} />}
      </div>
      <Legend cycles={view === "cycles"} />
      <p className="text-muted mt-1 text-small">{view === "lanes" ? t("timelineHelp") : t("cyclesHelp")}</p>
    </section>
  );
}
