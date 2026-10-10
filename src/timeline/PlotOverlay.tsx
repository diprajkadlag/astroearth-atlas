import { formatDate, formatDateTime } from "../i18n/format.ts";
import { eventTitle } from "../i18n/events.ts";
import { DAY_MS, HOUR_MS, type Span } from "../state/dates.ts";
import { useAtlas } from "../state/store.ts";
import { timeScale, type PlotHover, type PlotLayout } from "./plot.ts";

/**
 * The parts of a timeline view that move without a redraw of its canvas: the
 * ghost playhead with its label, and the brass date cursor (DESIGN.md,
 * motion: the cursor is an overlay, so playback does not redraw the chart).
 */
export function PlotOverlay({ layout, span, hover }: { layout: PlotLayout; span: Span; hover: PlotHover | null }) {
  const instantMs = useAtlas((state) => state.instantMs);
  const { xOf, msOf } = timeScale(layout, span);
  const cursorX = xOf(instantMs);
  const cursorVisible = layout.width > 0 && cursorX >= layout.x0 - 1 && cursorX <= layout.x1 + 1;
  const hoverStep = span.endMs - span.startMs < 60 * DAY_MS ? HOUR_MS : DAY_MS;
  const hoverMs = hover ? Math.round(msOf(hover.x) / hoverStep) * hoverStep : 0;
  const flip = hover !== null && hover.x > layout.width - 200;

  let label = "";
  if (hover?.event) {
    const when = hover.event.exact ? formatDateTime(hover.event.timeMs) : formatDate(hover.event.timeMs);
    label = `${eventTitle(hover.event)}, ${when}`;
  } else if (hover) {
    label = hoverStep < DAY_MS ? formatDateTime(hoverMs) : formatDate(hoverMs);
  }

  return (
    <>
      {hover ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0"
          style={{ left: hover.event ? xOf(hover.event.timeMs) : hover.x, height: layout.plotBottom }}
        >
          <div className="h-full w-px bg-ivory/50" />
          <p
            className={`absolute top-0 max-w-64 rounded-control bg-raised px-2 py-0.5 text-caption ${
              flip ? "right-2 text-right" : "left-2"
            }`}
          >
            {label}
          </p>
        </div>
      ) : null}
      {cursorVisible ? (
        <div
          aria-hidden="true"
          data-testid="lanes-cursor"
          className="pointer-events-none absolute top-0 w-0.5 bg-brass"
          style={{ height: layout.plotBottom, transform: `translateX(${cursorX - 1}px)` }}
        />
      ) : null}
    </>
  );
}
