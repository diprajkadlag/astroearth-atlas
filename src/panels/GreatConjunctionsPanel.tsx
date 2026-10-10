import { useEffect, useRef } from "react";

import type { GreatConjunction } from "../data/skyEvents.ts";
import { useSkyEvents } from "../data/skyEventsLoader.ts";
import { greatConjunctionId } from "../data/timelineEvents.ts";
import { secondaryButton } from "../design/controls.ts";
import { RULE_ALPHA, UI_COLORS, withAlpha } from "../design/palette.ts";
import { formatHistoricalDate } from "../engine/calendar.ts";
import { APPROXIMATE_BEFORE_YEAR } from "../engine/greatConjunctions.ts";
import { ELEMENTS, type Element } from "../engine/zodiac.ts";
import { formatDegrees } from "../i18n/format.ts";
import { t } from "../i18n/index.ts";
import { MAX_INSTANT_MS, MIN_INSTANT_MS } from "../state/dates.ts";
import { useAtlas } from "../state/store.ts";
import { useWidth } from "../timeline/plot.ts";

const START_MS = Date.UTC(1000, 0, 1);
const END_MS = Date.UTC(2101, 0, 1);
const APPROXIMATE_END_MS = Date.UTC(APPROXIMATE_BEFORE_YEAR, 0, 1);
/** A stable empty list while the sky events load. */
const NO_CONJUNCTIONS: readonly GreatConjunction[] = [];

const ELEMENT_TITLES: Readonly<Record<Element, Parameters<typeof t>[0]>> = {
  fire: "elementFireTitle",
  earth: "elementEarthTitle",
  air: "elementAirTitle",
  water: "elementWaterTitle",
};
const ELEMENT_NAMES: Readonly<Record<Element, Parameters<typeof t>[0]>> = {
  fire: "elementFire",
  earth: "elementEarth",
  air: "elementAir",
  water: "elementWater",
};

const ROW = 15;
const PANEL_TITLE = 18;
const PANEL = PANEL_TITLE + ELEMENTS.length * ROW;
const PANEL_GAP = 12;
const AXIS = 24;

function placement(sign: string, longitudeDeg: number, element: Element): string {
  return t("greatPlacement", { sign, degree: formatDegrees(longitudeDeg % 30), element: t(ELEMENT_NAMES[element]) });
}

/**
 * The element of each meeting, as small multiples: one panel per zodiac, one
 * row per element, one dot per conjunction. Position carries the element, so
 * no colour is needed. A brass line marks the date of the app.
 */
function ElementChart({ conjunctions, width }: { conjunctions: readonly GreatConjunction[]; width: number }) {
  const instantMs = useAtlas((state) => state.instantMs);
  const left = width < 560 ? 52 : 72;
  const right = width - 12;
  const x = (ms: number) => left + ((ms - START_MS) / (END_MS - START_MS)) * (right - left);
  const height = PANEL * 2 + PANEL_GAP + AXIS;
  const step = width < 600 ? 200 : 100;
  const years: number[] = [];
  for (let year = 1000; year <= 2100; year += step) years.push(year);

  const panel = (top: number, title: string, elementOf: (item: GreatConjunction) => Element) => (
    <g>
      <text x={left} y={top + 12} fill={UI_COLORS.ivory} fontSize="12" fontWeight="600">
        {title}
      </text>
      {ELEMENTS.map((element, index) => {
        const y = top + PANEL_TITLE + index * ROW + ROW / 2;
        return (
          <g key={element}>
            <line x1={left} x2={right} y1={y} y2={y} stroke={withAlpha(UI_COLORS.ivory, RULE_ALPHA.rule)} />
            <text x={left - 8} y={y + 4} textAnchor="end" fill={UI_COLORS.muted} fontSize="12">
              {t(ELEMENT_TITLES[element])}
            </text>
          </g>
        );
      })}
      {conjunctions.map((item) => (
        <circle
          key={item.timeMs}
          cx={x(item.timeMs)}
          cy={top + PANEL_TITLE + ELEMENTS.indexOf(elementOf(item)) * ROW + ROW / 2}
          r={width < 560 ? 2.5 : 3.5}
          fill={UI_COLORS.ivory}
          stroke={UI_COLORS.ground}
          strokeWidth={1}
        >
          <title>{`${formatHistoricalDate(new Date(item.timeMs))}: ${placement(item.siderealSign, item.siderealDeg, item.siderealElement)}`}</title>
        </circle>
      ))}
    </g>
  );

  const axisTop = PANEL * 2 + PANEL_GAP;
  return (
    <svg width={width} height={height} role="img" aria-label={t("greatChartLabel")} className="mt-3 block">
      {/* Positions before 1700 are approximate: a faint band behind both panels. */}
      <rect
        x={x(START_MS)}
        y={0}
        width={x(APPROXIMATE_END_MS) - x(START_MS)}
        height={axisTop}
        fill={withAlpha(UI_COLORS.ivory, 0.05)}
      />
      {panel(0, t("greatSidereal"), (item) => item.siderealElement)}
      {panel(PANEL + PANEL_GAP, t("greatTropical"), (item) => item.tropicalElement)}
      {instantMs >= START_MS && instantMs <= END_MS ? (
        <line x1={x(instantMs)} x2={x(instantMs)} y1={0} y2={axisTop} stroke={UI_COLORS.brass} strokeWidth={2} />
      ) : null}
      <line x1={left} x2={right} y1={axisTop + 2} y2={axisTop + 2} stroke={withAlpha(UI_COLORS.ivory, RULE_ALPHA.ruleStrong)} />
      {years.map((year) => {
        const position = x(Date.UTC(year, 0, 1));
        return (
          <g key={year}>
            <line x1={position} x2={position} y1={axisTop + 2} y2={axisTop + 6} stroke={UI_COLORS.muted} />
            <text x={position} y={axisTop + 19} textAnchor="middle" fill={UI_COLORS.muted} fontSize="12">
              {year}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The conjunctions of Jupiter and Saturn from 1000 to 2100 (plan, M5): the
 * date, the sidereal and the tropical sign and element. Dates before
 * 15 October 1582 are Julian. Those inside 1900 to 2050 can be shown in the sky.
 */
export function GreatConjunctionsPanel({ className = "" }: { className?: string }) {
  const sky = useSkyEvents();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const width = useWidth(boxRef);
  const jumpTo = useAtlas((state) => state.jumpTo);
  const conjunctions = sky?.greatConjunctions ?? NO_CONJUNCTIONS;
  const tableRef = useRef<HTMLDivElement | null>(null);
  const scrolledRef = useRef(false);

  // Once the list loads, the table opens at the date of the app, not at 1007.
  useEffect(() => {
    const box = tableRef.current;
    if (!box || scrolledRef.current || conjunctions.length === 0) return;
    scrolledRef.current = true;
    const instantMs = useAtlas.getState().instantMs;
    const index = Math.max(0, conjunctions.findIndex((item) => item.timeMs >= instantMs) - 1);
    const row = box.querySelectorAll("tbody tr")[index];
    const head = box.querySelector("thead");
    if (row instanceof HTMLElement) box.scrollTop = row.offsetTop - (head instanceof HTMLElement ? head.offsetHeight : 0);
  }, [conjunctions]);

  const show = (conjunction: GreatConjunction) => {
    jumpTo(conjunction.timeMs, { exact: true, eventId: greatConjunctionId(conjunction.timeMs) });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelector('[data-testid="scene"]')?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  return (
    <section aria-labelledby="great-title" className={`min-w-0 ${className}`} data-testid="great-conjunctions">
      <h2 id="great-title" className="font-display text-title-2">
        {t("greatTitle")}
      </h2>
      <p className="mt-1 max-w-prose text-small">{t("greatIntro")}</p>
      <p className="text-muted mt-1 max-w-prose text-small">{t("greatNotes")}</p>
      <div ref={boxRef} className="min-w-0">
        {width > 0 && conjunctions.length > 0 ? <ElementChart conjunctions={conjunctions} width={width} /> : null}
      </div>
      {conjunctions.length > 0 ? (
        <div
          ref={tableRef}
          role="region"
          tabIndex={0}
          aria-label={t("greatTableLabel")}
          className="relative mt-4 max-h-96 overflow-y-auto border-t border-rule"
        >
          <table className="w-full text-left text-small tabular-nums">
            <thead className="sticky top-0 bg-ground">
              <tr className="border-b border-rule-strong">
                <th scope="col" className="py-1.5 pr-3 font-semibold">
                  {t("greatColumnDate")}
                </th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">
                  {t("greatColumnSidereal")}
                </th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">
                  {t("greatColumnTropical")}
                </th>
                <th scope="col" className="py-1.5">
                  <span className="sr-only">{t("greatShow")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {conjunctions.map((item, index) => {
                const date = formatHistoricalDate(new Date(item.timeMs));
                const inRange = item.timeMs >= MIN_INSTANT_MS && item.timeMs <= MAX_INSTANT_MS;
                // The members of a triple conjunction share one block: a rule only between groups.
                const newGroup = index === 0 || conjunctions[index - 1]?.group !== item.group;
                return (
                  <tr key={item.timeMs} data-group={item.group} className={newGroup ? "border-t border-rule" : ""}>
                    <td className="py-1.5 pr-3">
                      {date}
                      {item.approximate ? <span className="text-muted">, {t("greatApproximate")}</span> : null}
                    </td>
                    <td className="py-1.5 pr-3">{placement(item.siderealSign, item.siderealDeg, item.siderealElement)}</td>
                    <td className="py-1.5 pr-3">{placement(item.tropicalSign, item.tropicalDeg, item.tropicalElement)}</td>
                    <td className="py-1 text-right">
                      {inRange ? (
                        <button
                          type="button"
                          onClick={() => show(item)}
                          aria-label={t("greatShowLabel", { date })}
                          className={secondaryButton}
                        >
                          {t("greatShow")}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
