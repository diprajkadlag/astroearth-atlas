import { useEffect, useMemo, useRef } from "react";

import { useSkyEvents } from "../data/skyEventsLoader.ts";
import { timelineEvents } from "../data/timelineEvents.ts";
import { RULE_ALPHA, UI_COLORS, withAlpha } from "../design/palette.ts";
import type { GrahaId } from "../engine/zodiac.ts";
import { formatDate } from "../i18n/format.ts";
import { t } from "../i18n/index.ts";
import { DAY_MS } from "../state/dates.ts";
import { useAtlas } from "../state/store.ts";
import { pairGrahas } from "../state/view.ts";
import { PAIR_DASHES, pairLabel, pairShort } from "./names.ts";
import { FONT, drawAxis, plotLayout, prepareCanvas, timeScale, trackGeometry, usePlotPointer, useWidth } from "./plot.ts";
import { PlotOverlay } from "./PlotOverlay.tsx";
import { drawTrack } from "./track.ts";
import { useCycleSamples } from "./useSamples.ts";

const MOON_MAX_SPAN_MS = 2 * 365.25 * DAY_MS;


/**
 * The Cycles view (plan, M4): for each chosen pair, the cosine of the angle
 * between the 2 grahas. One axis from -1 to +1: a conjunction at +1, a square
 * at 0, an opposition at -1. The waves show the rhythm of each pair.
 */
export function CyclesView({ height }: { height: number }) {
  const box = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const width = useWidth(box);

  const span = useAtlas((state) => state.span);
  const pairs = useAtlas((state) => state.pairs);
  const eventId = useAtlas((state) => state.eventId);
  const sky = useSkyEvents();
  const events = useMemo(() => timelineEvents(sky), [sky]);
  const layout = useMemo(() => plotLayout(width, height), [width, height]);
  const moonShown = span.endMs - span.startMs <= MOON_MAX_SPAN_MS;
  const shown = useMemo(() => pairs.filter((pair) => moonShown || !pair.includes("moon")), [pairs, moonShown]);
  const grahaPairs = useMemo(() => shown.map((pair) => pairGrahas(pair) as [GrahaId, GrahaId]), [shown]);
  const columns = width > 0 ? Math.round(layout.x1 - layout.x0) : 0;
  const samples = useCycleSamples(grahaPairs, span.startMs, span.endMs, columns);
  const { hover, handlers } = usePlotPointer(canvas, layout, span, events);

  useEffect(() => {
    const element = canvas.current;
    if (!element || width === 0) return;
    const ctx = prepareCanvas(element, width, height);
    if (!ctx) return;
    const { inset, x0, x1 } = layout;
    const { xOf } = timeScale(layout, span);
    const top = layout.plotTop + 8;
    const bottom = layout.plotBottom - 10;
    const yOf = (value: number) => top + ((1 - value) / 2) * (bottom - top);

    // Reference lines: conjunction, square and opposition.
    ctx.font = `500 12px ${FONT}`;
    ctx.textBaseline = "middle";
    for (const [value, key] of [
      [1, "cycleConjunction"],
      [0, "cycleSquare"],
      [-1, "cycleOpposition"],
    ] as const) {
      const y = Math.round(yOf(value)) + 0.5;
      ctx.strokeStyle = withAlpha(UI_COLORS.ivory, value === 0 ? RULE_ALPHA.rule : RULE_ALPHA.ruleStrong);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      ctx.fillStyle = UI_COLORS.muted;
      ctx.textAlign = inset ? "left" : "right";
      ctx.fillText(t(key), inset ? x0 + 4 : x0 - 10, inset ? y + (value === -1 ? -9 : 9) : y);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, top - 4, x1 - x0, bottom - top + 8);
    ctx.clip();
    const labels: { text: string; x: number; y: number }[] = [];
    shown.forEach((pair) => {
      const line = samples?.series.get(pair);
      if (!line) return;
      const packed = line.packed;
      ctx.strokeStyle = UI_COLORS.ivory;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.setLineDash([...(PAIR_DASHES[pairs.indexOf(pair)] ?? [])]);
      ctx.beginPath();
      let started = false;
      let lastX = 0;
      let lastY = 0;
      for (let k = 0; k < packed.length; k += 2) {
        const x = xOf(packed[k] as number);
        const y = yOf(packed[k + 1] as number);
        if (started) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        started = true;
        if (x <= x1) {
          lastX = x;
          lastY = y;
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // Direct label at the right end of the line (dataviz rule: 4 or fewer series carry labels).
      if (started) labels.push({ text: pairShort(pair), x: Math.min(lastX, x1), y: lastY - 10 });
    });
    ctx.restore();

    // Labels that would overlap move apart vertically, at least 17 px.
    labels.sort((a, b) => a.y - b.y);
    labels.forEach((label, index) => {
      const above = labels[index - 1];
      label.y = Math.max(label.y, top + 8, above ? above.y + 17 : -Infinity);
    });
    for (let index = labels.length - 1; index >= 0; index -= 1) {
      const label = labels[index] as (typeof labels)[number];
      const below = labels[index + 1];
      label.y = Math.min(label.y, bottom - 8, below ? below.y - 17 : Infinity);
    }
    ctx.font = `600 12px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const label of labels) {
      const textWidth = ctx.measureText(label.text).width;
      const labelX = label.x - textWidth - 6;
      ctx.fillStyle = withAlpha(UI_COLORS.ground, 0.85);
      ctx.fillRect(labelX - 3, label.y - 8, textWidth + 6, 16);
      ctx.fillStyle = UI_COLORS.ivory;
      ctx.fillText(label.text, labelX, label.y);
    }

    if (shown.length < pairs.length) {
      ctx.font = `400 12px ${FONT}`;
      ctx.fillStyle = UI_COLORS.muted;
      ctx.textAlign = "left";
      ctx.fillText(t("moonPairHidden"), x0 + 8, bottom - 8);
    }

    drawTrack(ctx, trackGeometry(layout, span), events, sky?.kalaSarpa ?? [], eventId);
    drawAxis(ctx, layout, span);
  }, [eventId, events, height, layout, pairs, samples, shown, sky, span, width]);

  return (
    <div ref={box} className="relative w-full" style={{ height }}>
      <canvas
        ref={canvas}
        role="img"
        aria-label={t("cyclesLabel", {
          pairs: shown.map(pairLabel).join(", "),
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
