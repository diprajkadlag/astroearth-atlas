import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { RULE_ALPHA, UI_COLORS, withAlpha } from "../design/palette.ts";
import { formatDate, formatDateTime } from "../i18n/format.ts";
import { t } from "../i18n/index.ts";
import { DAY_MS, MAX_INSTANT_MS, MIN_INSTANT_MS, MIN_SPAN_MS, spanAround, type Span } from "../state/dates.ts";
import { useAtlas } from "../state/store.ts";
import { FONT, prepareCanvas, useWidth } from "./plot.ts";

const PAD = 10;
const HEIGHT = 48;
/** The brush band sits above this line; the scale and its labels below it. */
const BAND_BOTTOM = 20;
const EDGE_PX = 7;
const TOTAL_DAYS = Math.round((MAX_INSTANT_MS - MIN_INSTANT_MS) / DAY_MS);

type Mode = "date" | "pan" | "resize-start" | "resize-end";

/**
 * The date ruler: 1900 to 2050 with a brass cursor. It is the WAI-ARIA slider
 * of the app (DESIGN.md, accessibility): the arrow keys step by the zoom unit,
 * Page Up and Page Down by 10 units, Home and End go to the limits, and Space
 * plays or pauses. Its upper band is the brush of the overview (plan, M4):
 * drag the band to pan the lanes, drag an edge to zoom.
 */
export function DateRuler() {
  const box = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const width = useWidth(box);
  const drag = useRef<{ mode: Mode; startX: number; span: Span } | null>(null);
  const [hoverMode, setHoverMode] = useState<Mode>("date");

  const instantMs = useAtlas((state) => state.instantMs);
  const span = useAtlas((state) => state.span);
  const setInstant = useAtlas((state) => state.setInstant);
  const stepInstant = useAtlas((state) => state.stepInstant);
  const togglePlaying = useAtlas((state) => state.togglePlaying);

  const x0 = PAD;
  const x1 = Math.max(PAD + 1, width - PAD);
  const msPerPx = (MAX_INSTANT_MS - MIN_INSTANT_MS) / (x1 - x0);
  const xOf = (ms: number) => x0 + (ms - MIN_INSTANT_MS) / msPerPx;
  const msOf = (x: number) => MIN_INSTANT_MS + (x - x0) * msPerPx;

  useEffect(() => {
    const element = canvas.current;
    if (!element || width === 0) return;
    const ctx = prepareCanvas(element, width, HEIGHT);
    if (!ctx) return;
    const left = PAD;
    const right = Math.max(PAD + 1, width - PAD);
    const x = (ms: number) => left + ((ms - MIN_INSTANT_MS) / (MAX_INSTANT_MS - MIN_INSTANT_MS)) * (right - left);

    // The brush band: the span of the lanes, with a grip at each edge.
    const bandLeft = x(span.startMs);
    const bandWidth = Math.max(3, x(span.endMs) - bandLeft);
    ctx.fillStyle = withAlpha(UI_COLORS.ivory, 0.08);
    ctx.fillRect(bandLeft, 3, bandWidth, BAND_BOTTOM - 4);
    ctx.strokeStyle = withAlpha(UI_COLORS.ivory, RULE_ALPHA.ruleStrong);
    ctx.lineWidth = 1;
    ctx.strokeRect(bandLeft + 0.5, 3.5, bandWidth - 1, BAND_BOTTOM - 5);
    ctx.strokeStyle = withAlpha(UI_COLORS.ivory, 0.7);
    for (const edge of [bandLeft, bandLeft + bandWidth]) {
      ctx.beginPath();
      ctx.moveTo(edge - 1.5, 7);
      ctx.lineTo(edge - 1.5, BAND_BOTTOM - 4);
      ctx.moveTo(edge + 1.5, 7);
      ctx.lineTo(edge + 1.5, BAND_BOTTOM - 4);
      ctx.stroke();
    }

    const baseline = BAND_BOTTOM + 2;
    ctx.strokeStyle = withAlpha(UI_COLORS.ivory, RULE_ALPHA.ruleStrong);
    ctx.beginPath();
    ctx.moveTo(left, baseline + 0.5);
    ctx.lineTo(right, baseline + 0.5);
    ctx.stroke();

    const yearPx = (right - left) / 151;
    const labelEvery = yearPx * 10 >= 44 ? 10 : yearPx * 25 >= 44 ? 25 : 50;
    ctx.font = `400 12px ${FONT}`;
    ctx.textBaseline = "top";
    for (let year = 1900; year <= 2050; year += 1) {
      const decade = year % 10 === 0;
      if (!decade && yearPx < 3) continue;
      const tickX = Math.round(x(Date.UTC(year, 0, 1))) + 0.5;
      ctx.strokeStyle = withAlpha(UI_COLORS.ivory, decade ? 0.6 : RULE_ALPHA.ruleStrong);
      ctx.beginPath();
      ctx.moveTo(tickX, baseline);
      ctx.lineTo(tickX, baseline + (decade ? 8 : 4));
      ctx.stroke();
      if (year % labelEvery === 0) {
        ctx.fillStyle = UI_COLORS.muted;
        ctx.textAlign = year === 1900 ? "left" : year === 2050 ? "right" : "center";
        ctx.fillText(String(year), year === 1900 ? tickX - 1 : year === 2050 ? tickX + 1 : tickX, baseline + 11);
      }
    }
  }, [span, width]);

  const local = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const modeAt = (x: number, y: number): Mode => {
    if (y > BAND_BOTTOM) return "date";
    const left = xOf(span.startMs);
    const right = xOf(span.endMs);
    if (Math.abs(x - left) <= EDGE_PX) return "resize-start";
    if (Math.abs(x - right) <= EDGE_PX) return "resize-end";
    return "pan";
  };

  const apply = (mode: Mode, x: number, start: { x: number; span: Span }) => {
    const store = useAtlas.getState();
    const clampedX = Math.min(x1, Math.max(x0, x));
    if (mode === "date") {
      setInstant(msOf(clampedX));
    } else if (mode === "pan") {
      const delta = (x - start.x) * msPerPx;
      store.setSpan({ startMs: start.span.startMs + delta, endMs: start.span.endMs + delta });
    } else if (mode === "resize-start") {
      store.setSpan({ startMs: Math.min(msOf(clampedX), start.span.endMs - MIN_SPAN_MS), endMs: start.span.endMs });
    } else {
      store.setSpan({ startMs: start.span.startMs, endMs: Math.max(msOf(clampedX), start.span.startMs + MIN_SPAN_MS) });
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const { x, y } = local(event);
    const mode = modeAt(x, y);
    let startSpan = span;
    if (mode === "pan" && (x < xOf(span.startMs) || x > xOf(span.endMs))) {
      // A press beside the band moves the band there.
      startSpan = spanAround(msOf(x), span.endMs - span.startMs);
      useAtlas.getState().setSpan(startSpan);
    }
    drag.current = { mode, startX: x, span: startSpan };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (mode === "date") apply("date", x, { x, span: startSpan });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const { x, y } = local(event);
    const current = drag.current;
    if (!current) {
      setHoverMode(modeAt(x, y));
      return;
    }
    apply(current.mode, x, { x: current.startX, span: current.span });
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
  const cursorClass =
    hoverMode === "date" ? "cursor-pointer" : hoverMode === "pan" ? "cursor-grab active:cursor-grabbing" : "cursor-ew-resize";

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
      aria-describedby="ruler-help"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onPointerLeave={() => setHoverMode("date")}
      className={`relative w-full touch-pan-y select-none ${cursorClass}`}
      style={{ height: HEIGHT }}
      data-testid="date-ruler"
    >
      <canvas ref={canvas} aria-hidden="true" className="absolute inset-0 h-full w-full" />
      <span id="ruler-help" className="sr-only">
        {t("rulerHelp")}
      </span>
      {width > 0 ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 h-[30px] w-0.5 bg-brass"
          style={{ transform: `translateX(${xOf(instantMs) - 1}px)` }}
        >
          <div className="absolute -top-0.5 -left-[5px] size-3 rotate-45 bg-brass" />
        </div>
      ) : null}
    </div>
  );
}
