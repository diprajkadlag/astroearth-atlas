import { grahaAbbreviation, grahaName, t } from "../i18n/index.ts";
import { pairGrahas, type CyclePair, type LaneId } from "../state/view.ts";

/** Names and line styles shared by the timeline views, the legend and the choosers. */

export function laneLabel(lane: LaneId): string {
  return lane === "rahu" ? t("laneRahuKetu") : grahaName(lane);
}

/** One line style per pair slot: identity by dash pattern and label, not by colour. */
export const PAIR_DASHES: readonly (readonly number[])[] = [[], [9, 4], [2, 3], [9, 3, 2, 3]];

export function pairLabel(pair: CyclePair): string {
  const [a, b] = pairGrahas(pair);
  return t("pairName", { a: grahaName(a), b: grahaName(b) });
}

/** "Ju–Sa": the direct label at the end of a cycle line. */
export function pairShort(pair: CyclePair): string {
  const [a, b] = pairGrahas(pair);
  return `${grahaAbbreviation(a)}–${grahaAbbreviation(b)}`;
}
