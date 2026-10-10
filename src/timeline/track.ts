import type { KalaSarpaWindow } from "../data/skyEvents.ts";
import type { TimelineEvent } from "../data/timelineEvents.ts";
import { GRAHA_COLOR_TOKENS, RULE_ALPHA, UI_COLORS, withAlpha } from "../design/palette.ts";

/**
 * The event track: a band at the top of each timeline canvas. Each kind of
 * event has its own shape, so identity never rests on colour alone:
 * a disc with a bite (solar eclipse), a ring (lunar eclipse), a diamond
 * (world event) and 2 rings (Jupiter-Saturn conjunction). Kala Sarpa windows
 * are verdigris bars, the hue of the Rahu-Ketu axis.
 */

export const TRACK_HEIGHT = 24;
const MARK = 5;

export interface TrackGeometry {
  top: number;
  x0: number;
  x1: number;
  xOf: (ms: number) => number;
  /** The colour behind the track, for the bite of the solar-eclipse mark. */
  ground: string;
}

export function drawTrack(
  ctx: CanvasRenderingContext2D,
  geometry: TrackGeometry,
  events: readonly TimelineEvent[],
  kalaSarpa: readonly KalaSarpaWindow[],
  selectedId: string | null,
): void {
  const { top, x0, x1, xOf, ground } = geometry;
  const y = top + TRACK_HEIGHT / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 - MARK - 2, top, x1 - x0 + 2 * MARK + 4, TRACK_HEIGHT);
  ctx.clip();

  ctx.strokeStyle = withAlpha(UI_COLORS.ivory, RULE_ALPHA.rule);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, Math.round(y) + 0.5);
  ctx.lineTo(x1, Math.round(y) + 0.5);
  ctx.stroke();

  ctx.fillStyle = withAlpha(GRAHA_COLOR_TOKENS.nodes, 0.55);
  for (const window of kalaSarpa) {
    const left = xOf(window.startMs);
    const right = xOf(window.endMs);
    if (right < x0 || left > x1) continue;
    ctx.fillRect(left, y + 4, Math.max(2, right - left), 3);
  }

  for (const event of events) {
    const x = xOf(event.timeMs);
    if (x < x0 - MARK || x > x1 + MARK) continue;
    drawMark(ctx, event, x, y, ground);
    if (event.id === selectedId) {
      // The selected event: a brass ring, like keyboard focus (DESIGN.md, brass).
      ctx.strokeStyle = UI_COLORS.brass;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, MARK + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawMark(ctx: CanvasRenderingContext2D, event: TimelineEvent, x: number, y: number, ground: string): void {
  switch (event.kind) {
    case "solar-eclipse":
      ctx.fillStyle = UI_COLORS.eclipse;
      ctx.beginPath();
      ctx.arc(x, y, MARK, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ground;
      ctx.beginPath();
      ctx.arc(x + MARK * 0.55, y - MARK * 0.2, MARK * 0.85, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "lunar-eclipse":
      ctx.strokeStyle = UI_COLORS.eclipse;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, MARK - 0.75, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "world":
      ctx.fillStyle = UI_COLORS.ivory;
      ctx.beginPath();
      ctx.moveTo(x, y - MARK - 1);
      ctx.lineTo(x + MARK + 1, y);
      ctx.lineTo(x, y + MARK + 1);
      ctx.lineTo(x - MARK - 1, y);
      ctx.closePath();
      ctx.fill();
      break;
    case "great-conjunction":
      ctx.strokeStyle = UI_COLORS.ivory;
      ctx.lineWidth = 1.4;
      for (const offset of [-0.45, 0.45]) {
        ctx.beginPath();
        ctx.arc(x + offset * MARK, y, MARK * 0.8, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
  }
}

/** The event under the pointer, if one lies within 7 px of it. World events win ties. */
export function hitTrack(
  geometry: TrackGeometry,
  events: readonly TimelineEvent[],
  x: number,
  y: number,
): TimelineEvent | null {
  if (y < geometry.top || y > geometry.top + TRACK_HEIGHT) return null;
  let best: TimelineEvent | null = null;
  let bestDistance = 7;
  for (const event of events) {
    const distance = Math.abs(geometry.xOf(event.timeMs) - x);
    const better = distance < bestDistance || (distance === bestDistance && event.kind === "world");
    if (better) {
      best = event;
      bestDistance = distance;
    }
  }
  return best;
}
