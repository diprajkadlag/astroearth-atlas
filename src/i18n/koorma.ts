import type { GlowReason, KoormaRegion, KoormaRegionId } from "../engine/koorma.ts";
import { NAKSHATRAS } from "../engine/zodiac.ts";
import { formatDate } from "./format.ts";
import type { MessageKey } from "./en.ts";
import { grahaName, t } from "./index.ts";

const REGION_KEYS: Readonly<Record<KoormaRegionId, MessageKey>> = {
  centre: "koormaRegionCentre",
  east: "koormaRegionEast",
  "south-east": "koormaRegionSouthEast",
  south: "koormaRegionSouth",
  "south-west": "koormaRegionSouthWest",
  west: "koormaRegionWest",
  "north-west": "koormaRegionNorthWest",
  north: "koormaRegionNorth",
  "north-east": "koormaRegionNorthEast",
};

export function regionName(id: KoormaRegionId): string {
  return t(REGION_KEYS[id]);
}

export function nakshatraNames(indices: readonly number[]): string {
  return indices.map((index) => NAKSHATRAS[index] ?? "").join(", ");
}

/** "West: Jyeshtha, Mula, Purva Ashadha" */
export function regionWithNakshatras(region: KoormaRegion): string {
  return t("koormaRegionNakshatras", { region: regionName(region.id), nakshatras: nakshatraNames(region.nakshatras) });
}

/** One sentence per reason of a lit region (DESIGN.md: the legend gives the reason). */
export function reasonText(reason: GlowReason): string {
  const nakshatra = NAKSHATRAS[reason.nakshatra] ?? "";
  switch (reason.kind) {
    case "eclipse":
      return t(reason.eclipse === "solar" ? "koormaReasonSolarEclipse" : "koormaReasonLunarEclipse", {
        nakshatra,
        date: formatDate(reason.timeMs),
      });
    case "station":
      return t(reason.turns === "retrograde" ? "koormaReasonStationRetrograde" : "koormaReasonStationDirect", {
        graha: grahaName(reason.graha),
        nakshatra,
        date: formatDate(reason.timeMs),
      });
    case "retrograde":
      return t("koormaReasonRetrograde", { graha: grahaName(reason.graha), nakshatra });
    case "transit":
      return t("koormaReasonTransit", { graha: grahaName(reason.graha), nakshatra });
  }
}
