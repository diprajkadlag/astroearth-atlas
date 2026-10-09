import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { RULE_ALPHA, UI_COLORS, withAlpha } from "../design/palette.ts";
import { formatDate, formatDateTime } from "../i18n/format.ts";
import { t } from "../i18n/index.ts";
import { DAY_MS, MAX_INSTANT_MS, MIN_INSTANT_MS } from "../state/dates.ts";
import { useAtlas } from "../state/store.ts";

const PAD = 10;
const FONT = '"Anek Devanagari", system-ui, sans-serif';
const TOTAL_DAYS = Math.round((MAX_INSTANT_MS - MIN_INSTANT_MS) / DAY_MS);

/**
 * The date ruler: 1900 to 2050 with a brass cursor. It is the WAI-ARIA slider
 * of the app (DESIGN.md, accessibility): the arrow keys step by the zoom unit,
 * Page Up and Page Down by 10 units, Home and End go to the limits, and Space
 * plays or pauses. The band shows the span of the lanes.
 */
export function DateRuler() {
  const box = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState(0);
  const dragging = useRef(false);

  const instantMs = useAtlas((state) => state.instantMs);
  const span = useAtlas((state) => state.span);
  const setInstant = useAtlas((state) => state.setInstant);
  const stepInstant = useAtlas((state) => state.stepInstant);
  const togglePlaying = useAtlas((state) => state.togglePlaying);

  const height = 44;
  const x0 = PAD;
  const x1 = Math.max(PAD + 1, width - PAD);
  const xOf = (ms: number) => x0 + ((ms - MIN_INSTANT_MS) / (MAX_INSTANT_MS - MIN_INSTANT_MS)) * (x1 - x0);
  const msOf = (x: number) => MIN_INSTANT_MS + ((x - x0) / (x1 - x0)) * (MAX_INSTANT_MS - MIN_INSTANT_MS);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The scale: a tick each year, a longer one each decade, labels where they fit.
  useEffect(() => {
    const element = canvas.current;
    if (!element || width === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    element.width = Math.round(width * dpr);
    element.height = Math.round(height * dpr);
    const ctx = element.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const left = PAD;
    const right = Math.max(PAD + 1, width - PAD);
    const x = (ms: number) => left + ((ms - MIN_INSTANT_MS) / (MAX_INSTANT_MS - MIN_INSTANT_MS)) * (right - left);
    const baseline = 20;

    // The span of the lanes.
    ctx.fillStyle = withAlpha(UI_COLORS.ivory, 0.08);
    const bandLeft = x(span.startMs);
    const bandWidth = Math.max(2, x(span.endMs) - bandLeft);
    ctx.fillRect(bandLeft, 4, bandWidth, baseline - 4);
    ctx.strokeStyle = withAlpha(UI_COLORS.ivory, RULE_ALPHA.ruleStrong);
    ctx.strokeRect(bandLeft + 0.5, 4.5, bandWidth - 1, baseline - 5);

    ctx.beginPath();
    ctx.moveTo(left, baseline + 0.5);
    ctx.lineTo(right, baseline + 0.5);
    ctx.stroke();

    const yearPx = (right - left) / 151;
    const labelEvery = yearPx * 10 >= 44 ? 10 : yearPx * 25 >= 44 ? 25 : 50;
    ctx.font = `400 12px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let year = 1900; year <= 2050; year += 1) {
      const decade = year % 10 === 0;
      if (!decade && yearPx < 3) continue;
      const tickX = Math.round(x(Date.UTC(year, 0, 1))) + 0.5;
      ctx.strokeStyle = withAlpha(UI_COLORS.ivory, decade ? 0.6 : RULE_ALPHA.ruleStrong);
      ctx.beginPath();
      ctx.moveTo(tickX, baseline - (decade ? 8 : 4));
      ctx.lineTo(tickX, baseline);
      ctx.stroke();
      if (year % labelEvery === 0) {
        ctx.fillStyle = UI_COLORS.muted;
        ctx.textAlign = year === 1900 ? "left" : year === 2050 ? "right" : "center";
        ctx.fillText(String(year), year === 1900 ? tickX - 1 : year === 2050 ? tickX + 1 : tickX, baseline + 6);
      }
    }
  }, [span, width]);

  const setFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(x1, Math.max(x0, event.clientX - rect.left));
    setInstant(msOf(x));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const actions: Record<string, () => void> = {
      ArrowLeft: () => stepInstant(-1),
      ArrowDown: () => stepInstant(-1),
      ArrowRight: () => stepInstant(1),
      ArrowUp: () => stepInstant(1),
      PageDown: () => stepInstant(-10),
      PageUp: () => stepInstant(10),
      Home: () => setInstant(MIN_INSTANT_MS),
      End: () => setInstant(MAX_INSTANT_MS),
      " ": togglePlaying,
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const timeShown = instantMs % DAY_MS !== 0;
  const valueText = timeShown ? formatDateTime(instantMs) : formatDate(instantMs);

  return (
    <div
      ref={box}
      role="slider"
      tabIndex={0}
      aria-label={t("dateSlider")}
      aria-valuemin={0}
      aria-valuemax={TOTAL_DAYS}
      aria-valuenow={Math.round((instantMs - MIN_INSTANT_MS) / DAY_MS)}
      aria-valuetext={valueText}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        setFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (dragging.current) setFromPointer(event);
      }}
      onPointerUp={(event) => {
        dragging.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      className="relative w-full cursor-pointer touch-pan-y select-none"
      style={{ height }}
      data-testid="date-ruler"
    >
      <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 h-full w-full" />
      {width > 0 ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 h-[26px] w-0.5 bg-brass"
          style={{ transform: `translateX(${xOf(instantMs) - 1}px)` }}
        >
          <div className="absolute -top-0.5 -left-[5px] size-3 rotate-45 bg-brass" />
        </div>
      ) : null}
    </div>
  );
}
