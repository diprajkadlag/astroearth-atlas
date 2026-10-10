import { useMemo, useSyncExternalStore, type ReactNode } from "react";

import { useSkyEvents } from "../data/skyEventsLoader.ts";
import { neighbourEvent, timelineEvents, type TimelineEvent } from "../data/timelineEvents.ts";
import { buttonBase, secondaryButton, toggleOn } from "../design/controls.ts";
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

const secondary = secondaryButton;

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

function LaneChooser({ phone }: { phone: boolean }) {
  const lanes = useAtlas((state) => state.lanes);
  const setLanes = useAtlas((state) => state.setLanes);
  // DESIGN.md: phones show the first 3 lanes, so a lane added there goes to the top.
  const shown = phone ? lanes.slice(0, 3) : lanes;
  const toggle = (lane: LaneId) => {
    if (shown.includes(lane)) setLanes(lanes.filter((item) => item !== lane));
    else if (phone) setLanes([lane, ...lanes.filter((item) => item !== lane)]);
    else setLanes(ALL_LANES.filter((item) => item === lane || lanes.includes(item)));
  };
  return (
    <details className="sm:relative">
      <summary className={`${secondary} flex cursor-pointer list-none items-center`}>{t("lanesChoose")}</summary>
      {/* On phones the panel spans the toolbar row, so it never leaves the screen. */}
      <fieldset className="absolute z-20 mt-1 rounded-control border border-rule-strong bg-raised p-3 max-sm:inset-x-0 sm:min-w-56">
        <legend className="sr-only">{t("lanesChoose")}</legend>
        {ALL_LANES.map((lane) => (
          <label key={lane} className="flex min-h-11 items-center gap-2 text-small sm:min-h-9">
            <input
              type="checkbox"
              checked={shown.includes(lane)}
              disabled={shown.length === 1 && shown.includes(lane)}
              onChange={() => toggle(lane)}
              className="size-4 accent-brass"
            />
            {laneLabel(lane)}
          </label>
        ))}
        <p className="text-muted mt-1 max-w-56 text-caption">{t("lanesMoonNote")}</p>
        {phone ? <p className="text-muted mt-1 max-w-56 text-caption">{t("lanesPhoneNote")}</p> : null}
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
    <details className="sm:relative">
      <summary className={`${secondary} flex cursor-pointer list-none items-center`}>{t("pairsChoose")}</summary>
      <fieldset className="absolute z-20 mt-1 rounded-control border border-rule-strong bg-raised p-3 max-sm:inset-x-0 sm:min-w-60">
        <legend className="text-muted mb-1 text-caption">{t("pairsLimit", { count: MAX_CYCLE_PAIRS })}</legend>
        {CYCLE_PAIRS.map((pair) => {
          const checked = pairs.includes(pair);
          return (
            <label key={pair} className="flex min-h-11 items-center gap-2 text-small sm:min-h-9">
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

  // Phones: Play and the ruler come right under the scene; these controls go under the chart (DESIGN.md, layout).
  const moreControls = (
    <div className={`relative flex flex-wrap items-center gap-2 ${phone ? "mt-3" : "mt-2"}`}>
      <button
        type="button"
        onClick={() => setInstant(clampInstant(startOfUtcDay(Date.now())))}
        className={secondary}
      >
        {t("today")}
      </button>
      <button
        type="button"
        aria-label={t("zoomOut")}
        onClick={() => zoom(2, useAtlas.getState().instantMs)}
        className={`${secondary} min-w-11`}
      >
        <span aria-hidden="true" className="text-lead sm:hidden">
          −
        </span>
        <span aria-hidden="true" className="max-sm:hidden">
          {t("zoomOut")}
        </span>
      </button>
      <button
        type="button"
        aria-label={t("zoomIn")}
        onClick={() => zoom(0.5, useAtlas.getState().instantMs)}
        className={`${secondary} min-w-11`}
      >
        <span aria-hidden="true" className="text-lead sm:hidden">
          +
        </span>
        <span aria-hidden="true" className="max-sm:hidden">
          {t("zoomIn")}
        </span>
      </button>
      <button type="button" onClick={() => go(previous)} disabled={!previous} className={secondary}>
        {t("previousEvent")}
      </button>
      <button type="button" onClick={() => go(next)} disabled={!next} className={secondary}>
        {t("nextEvent")}
      </button>
      {view === "lanes" ? <LaneChooser phone={phone} /> : <PairChooser />}
    </div>
  );

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
            className={`${buttonBase} bg-brass text-ground hover:bg-ivory sm:min-w-24`}
            data-testid="play"
          >
            {playing ? t("pause") : t("play")}
          </button>
          <label className="flex items-center gap-2 text-small">
            <span className="max-sm:sr-only">{t("speed")}</span>
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
      {phone ? null : moreControls}
      <div className="mt-3">
        <DateRuler />
      </div>
      <div className="mt-2">
        {view === "lanes" ? <LanesView height={phone ? 210 : 370} /> : <CyclesView height={phone ? 210 : 370} />}
      </div>
      <Legend cycles={view === "cycles"} />
      {phone ? moreControls : null}
      <p className="text-muted mt-1 text-small">{view === "lanes" ? t("timelineHelp") : t("cyclesHelp")}</p>
    </section>
  );
}
