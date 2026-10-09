import { useSyncExternalStore } from "react";

import { t } from "../i18n/index.ts";
import { clampInstant, startOfUtcDay } from "../state/dates.ts";
import { PLAY_SPEEDS, useAtlas, type PlaySpeed } from "../state/store.ts";
import { DateRuler } from "./DateRuler.tsx";
import { LanesView } from "./LanesView.tsx";

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
const secondary = `${buttonBase} border border-rule-strong hover:border-ivory`;

/** Play, speed, zoom, the date ruler and the lanes: one date drives them all. */
export function TimelineSection({ className = "" }: { className?: string }) {
  const playing = useAtlas((state) => state.playing);
  const speed = useAtlas((state) => state.speed);
  const togglePlaying = useAtlas((state) => state.togglePlaying);
  const setSpeed = useAtlas((state) => state.setSpeed);
  const setInstant = useAtlas((state) => state.setInstant);
  const zoom = useAtlas((state) => state.zoom);
  const phone = usePhone();

  return (
    <section aria-labelledby="timeline-title" className={`min-w-0 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <h2 id="timeline-title" className="w-full font-display text-title-2 sm:w-auto">
          {t("timelineTitle")}
        </h2>
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
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>
      <div className="mt-3">
        <DateRuler />
      </div>
      <div className="mt-2">
        <LanesView height={phone ? 180 : 340} />
      </div>
      <p className="text-muted mt-1 text-small">{t("timelineHelp")}</p>
    </section>
  );
}
