import { useEffect, useMemo, useRef } from "react";

import { between } from "../data/skyEvents.ts";
import { useSkyEvents } from "../data/skyEventsLoader.ts";
import { timelineEvents } from "../data/timelineEvents.ts";
import { RULE_ALPHA, UI_COLORS, grahaColor, grahaDash, withAlpha } from "../design/palette.ts";
import type { GrahaId } from "../engine/zodiac.ts";
import { formatDate } from "../i18n/format.ts";
import { t } from "../i18n/index.ts";
import { DAY_MS } from "../state/dates.ts";
import { useAtlas } from "../state/store.ts";
import type { LaneId } from "../state/view.ts";
import { laneLabel } from "./names.ts";
import { FONT, drawAxis, plotLayout, prepareCanvas, timeScale, trackGeometry, usePlotPointer, useWidth } from "./plot.ts";
import { PlotOverlay } from "./PlotOverlay.tsx";
import { drawTrack } from "./track.ts";
import { useSamples } from "./useSamples.ts";

const LANE_GAP = 8;
const MOON_MAX_SPAN_MS = 2 * 365.25 * DAY_MS;

/** The grahas drawn in a lane. The Rahu lane holds Rahu and Ketu. */
function laneSeries(lane: LaneId): GrahaId[] {
  return lane === "rahu" ? ["rahu", "ketu"] : [lane];
}


/** Planets whose retrograde parts are drawn thicker. The nodes always move backward. */
function showsRetrograde(id: GrahaId): boolean {
  return id !== "sun" && id !== "moon" && id !== "rahu" && id !== "ketu";
}

/**
 * The lanes (DESIGN.md, timeline): small multiples, one graha per lane, the
 * y axis from 0 to 360 degrees. Lines break at the wrap, retrograde parts are
 * thicker, stations are triangles and exact conjunctions are dots.
 */
export function LanesView({ height }: { height: number }) {
  const box = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const width = useWidth(box);

  const span = useAtlas((state) => state.span);
  const allLanes = useAtlas((state) => state.lanes);
  const eventId = useAtlas((state) => state.eventId);
  const sky = useSkyEvents();
  const events = useMemo(() => timelineEvents(sky), [sky]);

  // DESIGN.md: phones show the first 3 lanes.
  const lanes = useMemo(() => (width > 0 && width < 640 ? allLanes.slice(0, 3) : allLanes), [allLanes, width]);
  const layout = useMemo(() => plotLayout(width, height), [width, height]);
  const laneHeight = Math.max(12, (layout.plotBottom - 4 - layout.plotTop - LANE_GAP * (lanes.length - 1)) / lanes.length);
  const moonShown = span.endMs - span.startMs <= MOON_MAX_SPAN_MS;
  const ids = useMemo(() => lanes.flatMap(laneSeries).filter((id) => id !== "moon" || moonShown), [lanes, moonShown]);
  // No request before the first measure: a 1-column answer would draw straight lines.
  const columns = width > 0 ? Math.round(layout.x1 - layout.x0) : 0;
  const samples = useSamples(ids, span.startMs, span.endMs, columns);
  const { hover, handlers } = usePlotPointer(canvas, layout, span, events);

  useEffect(() => {
    const element = canvas.current;
    if (!element || width === 0) return;
    const ctx = prepareCanvas(element, width, height);
    if (!ctx) return;
    const { inset, x0, x1 } = layout;
    const { xOf } = timeScale(layout, span);
    const rule = withAlpha(UI_COLORS.ivory, RULE_ALPHA.rule);
    const band = withAlpha(UI_COLORS.ivory, 0.035);
    // Stations and conjunction dots need room: below about 40 px a year they would pile up.
    const pxPerYear = (x1 - x0) / ((span.endMs - span.startMs) / (365.25 * DAY_MS));
    const roomForMarks = pxPerYear >= 40;
    const stations = sky && roomForMarks ? between(sky.stations, span.startMs, span.endMs) : [];
    const conjunctions = sky && roomForMarks ? between(sky.conjunctions, span.startMs, span.endMs) : [];

    lanes.forEach((lane, index) => {
      const top = layout.plotTop + index * (laneHeight + LANE_GAP);
      const yOf = (degrees: number) => top + laneHeight * (1 - degrees / 360);
      const series = laneSeries(lane);

      // 12 faint sign bands, every second one filled.
      ctx.fillStyle = band;
      for (let sign = 0; sign < 12; sign += 2) ctx.fillRect(x0, yOf((sign + 1) * 30), x1 - x0, laneHeight / 12);
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
      const drawName = () => {
        ctx.font = `500 12px ${FONT}`;
        ctx.textBaseline = "middle";
        const labelWidth = ctx.measureText(label).width;
        const nameY = inset ? top + 10 : top + laneHeight / 2;
        const dashFrom = inset ? x0 + 4 : x0 - 16 - labelWidth;
        if (inset) {
          ctx.fillStyle = withAlpha(UI_COLORS.ground, 0.85);
          ctx.fillRect(x0 + 1, top + 2, labelWidth + 26, 16);
        }
        ctx.textAlign = inset ? "left" : "right";
        ctx.fillStyle = UI_COLORS.ivory;
        ctx.fillText(label, inset ? x0 + 20 : x0 - 10, nameY);
        ctx.strokeStyle = grahaColor(lane);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dashFrom, nameY);
        ctx.lineTo(dashFrom + (inset ? 10 : -10), nameY);
        ctx.stroke();
      };
      if (!inset) drawName();

      if (lane === "moon" && !moonShown) {
        ctx.font = `400 12px ${FONT}`;
        ctx.fillStyle = UI_COLORS.muted;
        ctx.textAlign = "left";
        ctx.fillText(t("moonLaneHidden"), x0 + 8, top + laneHeight / 2);
        if (inset) drawName();
        return;
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, top - 6, x1 - x0, laneHeight + 12);
      ctx.clip();
      for (const id of series) {
        // Older samples still sit at their true times while new ones are on the way.
        const line = samples?.series.get(id);
        if (!line) continue;
        const packed = line.packed;
        ctx.strokeStyle = grahaColor(id);
        ctx.setLineDash(grahaDash(id).map((value) => value * 1.5));
        ctx.lineJoin = "round";
        let open = false;
        let retrograde = false;
        const flush = () => {
          if (open) ctx.stroke();
          open = false;
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
          if (!open || backward !== retrograde) {
            flush();
            retrograde = backward;
            ctx.lineWidth = retrograde ? 3 : 1.5;
            ctx.beginPath();
            ctx.moveTo(xOf(xa), yOf(ya));
            open = true;
          }
          ctx.lineTo(xOf(xb), yOf(yb));
        }
        flush();
      }
      ctx.setLineDash([]);

      // Stations: a triangle that points the new way of motion.
      for (const station of stations) {
        if (!series.includes(station.graha)) continue;
        const x = xOf(station.timeMs);
        const y = yOf(station.longitudeDeg);
        const tip = station.turns === "retrograde" ? 5 : -5;
        ctx.fillStyle = grahaColor(station.graha);
        ctx.strokeStyle = UI_COLORS.ground;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + tip);
        ctx.lineTo(x - 4.5, y - tip * 0.7);
        ctx.lineTo(x + 4.5, y - tip * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Exact conjunctions: an ivory dot in both lanes of the pair.
      for (const conjunction of conjunctions) {
        if (!series.includes(conjunction.a) && !series.includes(conjunction.b)) continue;
        const x = xOf(conjunction.timeMs);
        const y = yOf(conjunction.longitudeDeg);
        ctx.fillStyle = UI_COLORS.ivory;
        ctx.strokeStyle = UI_COLORS.ground;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      if (inset) drawName();
    });

    drawTrack(ctx, trackGeometry(layout, span), events, sky?.kalaSarpa ?? [], eventId);
    drawAxis(ctx, layout, span);
  }, [events, eventId, height, laneHeight, lanes, layout, moonShown, samples, sky, span, width]);

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
        className="absolute inset-0 h-full w-full cursor-grab touch-pan-y active:cursor-grabbing"
        {...handlers}
      />
      <PlotOverlay layout={layout} span={span} hover={hover} />
    </div>
  );
}
