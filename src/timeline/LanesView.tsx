import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";

import type { GrahaId } from "../engine/zodiac.ts";
import { RULE_ALPHA, UI_COLORS, grahaColor, grahaDash, withAlpha } from "../design/palette.ts";
import { formatDate, formatDateTime } from "../i18n/format.ts";
import { grahaName, t } from "../i18n/index.ts";
import { DAY_MS, HOUR_MS } from "../state/dates.ts";
import { useAtlas } from "../state/store.ts";
import type { LaneId } from "../state/view.ts";
import { axisTicks } from "./ticks.ts";
import { useSamples } from "./useSamples.ts";

const LANE_GAP = 8;
const TOP = 6;
const AXIS_HEIGHT = 26;
const RIGHT_PAD = 14;
const MOON_MAX_SPAN_MS = 2 * 365.25 * DAY_MS;
const FONT = '"Anek Devanagari", system-ui, sans-serif';

/** The grahas drawn in a lane. The Rahu lane holds Rahu and Ketu. */
function laneSeries(lane: LaneId): GrahaId[] {
  return lane === "rahu" ? ["rahu", "ketu"] : [lane];
}

function laneLabel(lane: LaneId): string {
  return lane === "rahu" ? t("laneRahuKetu") : grahaName(lane);
}

/** Planets whose retrograde parts are drawn thicker. The nodes always move backward. */
function showsRetrograde(id: GrahaId): boolean {
  return id !== "sun" && id !== "moon" && id !== "rahu" && id !== "ketu";
}

interface Layout {
  /** True when lane names sit inside the lanes (narrow screens). */
  inset: boolean;
  x0: number;
  x1: number;
  laneHeight: number;
  lanes: LaneId[];
}

function layoutFor(width: number, height: number, lanes: LaneId[]): Layout {
  const inset = width < 560;
  const x0 = inset ? 8 : 112;
  const x1 = Math.max(x0 + 1, width - RIGHT_PAD);
  const laneHeight = Math.max(12, (height - TOP - AXIS_HEIGHT - LANE_GAP * (lanes.length - 1)) / lanes.length);
  return { inset, x0, x1, laneHeight, lanes };
}

export function LanesView({ height }: { height: number }) {
  const box = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState(0);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const dragging = useRef(false);

  const span = useAtlas((state) => state.span);
  const allLanes = useAtlas((state) => state.lanes);
  const instantMs = useAtlas((state) => state.instantMs);
  const setInstant = useAtlas((state) => state.setInstant);
  const zoom = useAtlas((state) => state.zoom);
  const setSpan = useAtlas((state) => state.setSpan);

  // DESIGN.md: phones show the first 3 lanes.
  const lanes = useMemo(() => (width > 0 && width < 640 ? allLanes.slice(0, 3) : allLanes), [allLanes, width]);
  const layout = useMemo(() => layoutFor(width, height, lanes), [width, height, lanes]);
  const moonShown = span.endMs - span.startMs <= MOON_MAX_SPAN_MS;
  const ids = useMemo(
    () => lanes.flatMap(laneSeries).filter((id) => id !== "moon" || moonShown),
    [lanes, moonShown],
  );
  // No request before the first measure: a 1-column answer would draw straight lines.
  const columns = width > 0 ? Math.round(layout.x1 - layout.x0) : 0;
  const samples = useSamples(ids, span.startMs, span.endMs, columns);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const xOf = useCallback(
    (ms: number) => layout.x0 + ((ms - span.startMs) / (span.endMs - span.startMs)) * (layout.x1 - layout.x0),
    [layout, span],
  );
  const msOf = useCallback(
    (x: number) => span.startMs + ((x - layout.x0) / (layout.x1 - layout.x0)) * (span.endMs - span.startMs),
    [layout, span],
  );

  // Draw the lanes. The date cursor is not drawn here (see the overlay below).
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

    const { inset, x0, x1, laneHeight } = layout;
    const rule = withAlpha(UI_COLORS.ivory, RULE_ALPHA.rule);
    const band = withAlpha(UI_COLORS.ivory, 0.035);

    lanes.forEach((lane, index) => {
      const top = TOP + index * (laneHeight + LANE_GAP);
      const yOf = (degrees: number) => top + laneHeight * (1 - degrees / 360);

      // 12 faint sign bands, every second one filled.
      ctx.fillStyle = band;
      for (let sign = 0; sign < 12; sign += 2) {
        ctx.fillRect(x0, yOf((sign + 1) * 30), x1 - x0, laneHeight / 12);
      }
      ctx.strokeStyle = rule;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, top + 0.5);
      ctx.lineTo(x1, top + 0.5);
      ctx.moveTo(x0, top + laneHeight - 0.5);
      ctx.lineTo(x1, top + laneHeight - 0.5);
      ctx.stroke();

      // Lane name, with a colour dash: identity never rests on colour alone.
      const label = laneLabel(lane);
      const labelY = top + laneHeight / 2;
      const drawName = () => {
        ctx.font = `500 12px ${FONT}`;
        ctx.textBaseline = "middle";
        const labelWidth = ctx.measureText(label).width;
        const nameY = inset ? top + 10 : labelY;
        const textX = inset ? x0 + 20 : x0 - 10;
        const dashFrom = inset ? x0 + 4 : x0 - 16 - labelWidth;
        if (inset) {
          ctx.fillStyle = withAlpha(UI_COLORS.ground, 0.85);
          ctx.fillRect(x0 + 1, top + 2, labelWidth + 26, 16);
        }
        ctx.textAlign = inset ? "left" : "right";
        ctx.fillStyle = UI_COLORS.ivory;
        ctx.fillText(label, textX, nameY);
        ctx.strokeStyle = grahaColor(lane);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dashFrom, nameY);
        ctx.lineTo(dashFrom + (inset ? 10 : -10), nameY);
        ctx.stroke();
      };
      if (!inset) drawName();

      if (lane === "moon" && !moonShown) {
        ctx.fillStyle = UI_COLORS.muted;
        ctx.textAlign = "left";
        ctx.fillText(t("moonLaneHidden"), x0 + 8, labelY);
        if (inset) drawName();
        return;
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, top, x1 - x0, laneHeight);
      ctx.clip();
      for (const id of laneSeries(lane)) {
        // Older samples still sit at their true times while new ones are on the way.
        const series = samples?.series.get(id);
        if (!series) continue;
        const packed = series.packed;
        ctx.strokeStyle = grahaColor(id);
        ctx.setLineDash(grahaDash(id).map((value) => value * 1.5));
        ctx.lineJoin = "round";
        let pathOpen = false;
        let retrograde = false;
        const flush = () => {
          if (pathOpen) ctx.stroke();
          pathOpen = false;
        };
        for (let k = 2; k < packed.length; k += 2) {
          const xa = packed[k - 2] as number;
          const ya = packed[k - 1] as number;
          const xb = packed[k] as number;
          const yb = packed[k + 1] as number;
          if (Number.isNaN(xa) || Number.isNaN(xb)) {
            flush();
            continue;
          }
          const backward = showsRetrograde(id) && yb < ya;
          if (!pathOpen || backward !== retrograde) {
            flush();
            retrograde = backward;
            ctx.lineWidth = retrograde ? 3 : 1.5;
            ctx.beginPath();
            ctx.moveTo(xOf(xa), yOf(ya));
            pathOpen = true;
          }
          ctx.lineTo(xOf(xb), yOf(yb));
        }
        flush();
      }
      ctx.setLineDash([]);
      ctx.restore();
      if (inset) drawName();
    });

    // Time axis: a tick each interval, labels where they fit, years in bold.
    const axisY = height - AXIS_HEIGHT + 4;
    ctx.strokeStyle = withAlpha(UI_COLORS.ivory, RULE_ALPHA.ruleStrong);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, axisY + 0.5);
    ctx.lineTo(x1, axisY + 0.5);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const tick of axisTicks(span.startMs, span.endMs, x1 - x0)) {
      const x = Math.round(xOf(tick.ms)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, axisY);
      ctx.lineTo(x, axisY + (tick.label ? 6 : 3));
      ctx.stroke();
      if (tick.label) {
        ctx.font = `${tick.strong ? 650 : 400} 12px ${FONT}`;
        // A label that would leave the canvas is left out; its tick stays.
        const half = ctx.measureText(tick.label).width / 2;
        if (x - half < 0 || x + half > width) continue;
        ctx.fillStyle = tick.strong ? UI_COLORS.ivory : UI_COLORS.muted;
        ctx.fillText(tick.label, x, axisY + 8);
      }
    }
  }, [height, lanes, layout, moonShown, samples, span, width, xOf]);

  const setFromPointer = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(layout.x1, Math.max(layout.x0, event.clientX - rect.left));
    setInstant(msOf(x));
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setFromPointer(event);
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    setHoverX(x >= layout.x0 && x <= layout.x1 ? x : null);
    if (dragging.current) setFromPointer(event);
  };

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      zoom(event.deltaY > 0 ? 1.2 : 1 / 1.2, msOf(x));
    } else if (event.shiftKey) {
      event.preventDefault();
      const shift = (Math.sign(event.deltaY || event.deltaX) * (span.endMs - span.startMs)) / 10;
      setSpan({ startMs: span.startMs + shift, endMs: span.endMs + shift });
    }
  };

  // Browsers attach React wheel listeners as passive, so preventDefault needs a native listener.
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const block = (event: globalThis.WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) event.preventDefault();
    };
    element.addEventListener("wheel", block, { passive: false });
    return () => element.removeEventListener("wheel", block);
  }, []);

  const cursorX = xOf(instantMs);
  const cursorVisible = width > 0 && cursorX >= layout.x0 - 1 && cursorX <= layout.x1 + 1;
  const plotBottom = height - AXIS_HEIGHT + 4;
  const hoverStep = span.endMs - span.startMs < 60 * DAY_MS ? HOUR_MS : DAY_MS;
  const hoverMs = hoverX === null ? null : Math.round(msOf(hoverX) / hoverStep) * hoverStep;

  return (
    <div ref={box} className="relative w-full" style={{ height }}>
      <canvas
        ref={canvas}
        role="img"
        aria-label={t("lanesLabel", {
          grahas: lanes.map(laneLabel).join(", "),
          start: formatDate(span.startMs),
          end: formatDate(span.endMs),
        })}
        className="absolute inset-0 h-full w-full cursor-col-resize touch-pan-y"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHoverX(null)}
        onWheel={onWheel}
      />
      {hoverX !== null && hoverMs !== null ? (
        <div aria-hidden="true" className="pointer-events-none absolute top-0" style={{ left: hoverX, height: plotBottom }}>
          <div className="h-full w-px bg-ivory/50" />
          <p className="absolute top-0 left-2 rounded-control bg-raised px-2 py-0.5 text-caption whitespace-nowrap">
            {hoverStep < DAY_MS ? formatDateTime(hoverMs) : formatDate(hoverMs)}
          </p>
        </div>
      ) : null}
      {cursorVisible ? (
        <div
          aria-hidden="true"
          data-testid="lanes-cursor"
          className="pointer-events-none absolute top-0 w-0.5 bg-brass"
          style={{ height: plotBottom, transform: `translateX(${cursorX - 1}px)` }}
        />
      ) : null}
    </div>
  );
}
