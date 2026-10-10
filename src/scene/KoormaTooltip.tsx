import { koormaRegion, koormaRegionAt } from "../engine/koorma.ts";
import { t } from "../i18n/index.ts";
import { reasonText, regionWithNakshatras } from "../i18n/koorma.ts";
import { useKoormaGlow } from "../state/hooks.ts";
import { useAtlas } from "../state/store.ts";
import { useGlobeHover } from "./hover.ts";

const TOOLTIP_WIDTH = 260;

/**
 * The Koorma region under the pointer, with the reasons it glows (DESIGN.md:
 * the reason on hover). The legend beside the scene gives the same text for
 * keyboard and screen-reader users.
 */
export function KoormaTooltip() {
  const hover = useGlobeHover();
  const mode = useAtlas((state) => state.koorma);
  const glow = useKoormaGlow();
  if (!hover) return null;

  const place = koormaRegionAt(hover, mode);
  const region = place.region ? koormaRegion(place.region) : null;
  const regionGlow = region ? glow.find((item) => item.region.id === region.id) : undefined;

  // Keep the box inside the scene: it flips to the left or above the pointer near an edge.
  const left = hover.x + 16 + TOOLTIP_WIDTH > hover.width ? Math.max(8, hover.x - 16 - TOOLTIP_WIDTH) : hover.x + 16;
  const top = hover.y > hover.height * 0.6 ? undefined : hover.y + 16;
  const bottom = hover.y > hover.height * 0.6 ? hover.height - hover.y + 16 : undefined;

  return (
    <div
      aria-hidden="true"
      data-testid="koorma-tooltip"
      className="pointer-events-none absolute z-10 rounded-control border border-rule-strong bg-raised/95 px-3 py-2 text-small"
      style={{ left, top, bottom, width: TOOLTIP_WIDTH }}
    >
      {region ? (
        <>
          <p className="font-semibold">{regionWithNakshatras(region)}</p>
          {regionGlow && regionGlow.reasons.length > 0 ? (
            <ul className="mt-1 space-y-0.5">
              {regionGlow.reasons.map((reason, index) => (
                <li key={index}>{reasonText(reason)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted mt-1">{t("koormaNotLit")}</p>
          )}
        </>
      ) : (
        <p className="text-muted">{t(mode === "classical" ? "koormaOutsideClassical" : "koormaOutsideGlobal")}</p>
      )}
    </div>
  );
}
