import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

import type { TimelineEvent } from "../data/timelineEvents.ts";
import { RULE_ALPHA, UI_COLORS, withAlpha } from "../design/palette.ts";
import type { Span } from "../state/dates.ts";
import { useAtlas } from "../state/store.ts";
import { axisTicks } from "./ticks.ts";
import { TRACK_HEIGHT, hitTrack, type TrackGeometry } from "./track.ts";

/**
 * Shared layout and pointer model of the 2 timeline views (Lanes and
 * Cycles). Both use one time axis, so a date sits at the same x in both.
 */

export const FONT = '"Anek Devanagari", system-ui, sans-serif';
const AXIS_HEIGHT = 26;
const RIGHT_PAD = 14;
const TRACK_TOP = 2;
const DRAG_THRESHOLD_PX = 4;

export interface PlotLayout {
  width: number;
  height: number;
  /** Narrow screens: names sit inside the plot, which keeps the full width. */
  inset: boolean;
  x0: number;
  x1: number;
  trackTop: number;
  plotTop: number;
  plotBottom: number;
}

export function plotLayout(width: number, height: number): PlotLayout {
  const inset = width < 560;
  const x0 = inset ? 8 : 112;
  return {
    width,
    height,
    inset,
    x0,
    x1: Math.max(x0 + 1, width - RIGHT_PAD),
    trackTop: TRACK_TOP,
    plotTop: TRACK_TOP + TRACK_HEIGHT + 6,
    plotBottom: height - AXIS_HEIGHT + 4,
  };
}

export function timeScale(layout: PlotLayout, span: Span) {
  const length = span.endMs - span.startMs;
  return {
    xOf: (ms: number) => layout.x0 + ((ms - span.startMs) / length) * (layout.x1 - layout.x0),
    msOf: (x: number) => span.startMs + ((x - layout.x0) / (layout.x1 - layout.x0)) * length,
  };
}

export function trackGeometry(layout: PlotLayout, span: Span): TrackGeometry {
  return { top: layout.trackTop, x0: layout.x0, x1: layout.x1, xOf: timeScale(layout, span).xOf, ground: UI_COLORS.ground };
}

/** The time axis: a tick each interval, labels where they fit, years in bold. */
export function drawAxis(ctx: CanvasRenderingContext2D, layout: PlotLayout, span: Span): void {
  const { xOf } = timeScale(layout, span);
  const axisY = layout.plotBottom;
  ctx.strokeStyle = withAlpha(UI_COLORS.ivory, RULE_ALPHA.ruleStrong);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(layout.x0, axisY + 0.5);
  ctx.lineTo(layout.x1, axisY + 0.5);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const tick of axisTicks(span.startMs, span.endMs, layout.x1 - layout.x0)) {
    const x = Math.round(xOf(tick.ms)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, axisY);
    ctx.lineTo(x, axisY + (tick.label ? 6 : 3));
    ctx.stroke();
    if (!tick.label) continue;
    ctx.font = `${tick.strong ? 650 : 400} 12px ${FONT}`;
    // A label that would leave the canvas is left out; its tick stays.
    const half = ctx.measureText(tick.label).width / 2;
    if (x - half < 0 || x + half > layout.width) continue;
    ctx.fillStyle = tick.strong ? UI_COLORS.ivory : UI_COLORS.muted;
    ctx.fillText(tick.label, x, axisY + 8);
  }
}

/** Prepares a canvas for the device pixel ratio and returns its context. */
export function prepareCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return ctx;
}

/** Width of an element, kept current with a ResizeObserver. */
export function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

export interface PlotHover {
  x: number;
  event: TimelineEvent | null;
}

/**
 * Pointer model (plan, M4): a click sets the date, or opens the event under
 * the pointer; a drag pans; Ctrl or Cmd with the wheel zooms at the pointer;
 * Shift with the wheel pans.
 */
export function usePlotPointer(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  layout: PlotLayout,
  span: Span,
  events: readonly TimelineEvent[],
) {
  const [hover, setHover] = useState<PlotHover | null>(null);
  const drag = useRef<{ pointerId: number; startX: number; span: Span; moved: boolean } | null>(null);
  const { msOf } = timeScale(layout, span);

  // React attaches wheel listeners as passive, so preventDefault needs a native listener.
  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const block = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) event.preventDefault();
    };
    element.addEventListener("wheel", block, { passive: false });
    return () => element.removeEventListener("wheel", block);
  }, [canvasRef]);

  const localX = (event: { clientX: number; currentTarget: Element }) =>
    event.clientX - event.currentTarget.getBoundingClientRect().left;
  const localY = (event: { clientY: number; currentTarget: Element }) =>
    event.clientY - event.currentTarget.getBoundingClientRect().top;

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    drag.current = { pointerId: event.pointerId, startX: localX(event), span, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const x = localX(event);
    const inside = x >= layout.x0 && x <= layout.x1;
    const geometry = trackGeometry(layout, span);
    setHover(inside ? { x, event: hitTrack(geometry, events, x, localY(event)) } : null);
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = x - current.startX;
    if (!current.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
    current.moved = true;
    const msPerPx = (current.span.endMs - current.span.startMs) / (layout.x1 - layout.x0);
    useAtlas.getState().setSpan({
      startMs: current.span.startMs - dx * msPerPx,
      endMs: current.span.endMs - dx * msPerPx,
    });
  };

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!current || current.moved) return;
    const x = Math.min(layout.x1, Math.max(layout.x0, localX(event)));
    const hit = hitTrack(trackGeometry(layout, span), events, localX(event), localY(event));
    if (hit) {
      useAtlas.getState().jumpTo(hit.timeMs, { exact: hit.exact || hit.kind === "world", eventId: hit.id });
    } else {
      useAtlas.getState().setInstant(msOf(x));
    }
  };

  const onPointerCancel = () => {
    drag.current = null;
  };

  const onWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    const x = localX(event);
    if (event.ctrlKey || event.metaKey) {
      useAtlas.getState().zoom(event.deltaY > 0 ? 1.2 : 1 / 1.2, msOf(x));
    } else if (event.shiftKey) {
      const shift = (Math.sign(event.deltaY || event.deltaX) * (span.endMs - span.startMs)) / 10;
      useAtlas.getState().panSpan(shift);
    }
  };

  return {
    hover,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave: () => setHover(null),
      onWheel,
    },
  };
}
