import { grahaColor } from "../design/palette.ts";
import { formatDegrees, formatUtcTime } from "../i18n/format.ts";
import { grahaName, t } from "../i18n/index.ts";
import { NAKSHATRA_DEVANAGARI } from "../i18n/sanskrit.ts";
import { useSky } from "../state/hooks.ts";
import { useAtlas } from "../state/store.ts";

const SCALE_BACKGROUND =
  "repeating-linear-gradient(90deg, rgb(234 227 210 / 0.24) 0 1px, transparent 1px calc(100% / 12))";

/**
 * The sky as text: the table view of the scene and the lanes (DESIGN.md,
 * timeline). Each row has a 12-sign scale with a mark at the sidereal
 * longitude, then the sign, the degree and the nakshatra.
 */
export function SkyTable({ className = "" }: { className?: string }) {
  const instantMs = useAtlas((state) => state.instantMs);
  const { sky, kalaSarpa } = useSky();

  return (
    <section aria-labelledby="sky-title" className={`min-w-0 ${className}`}>
      <h2 id="sky-title" className="font-display text-title-2">
        {t("skyTitle", { time: formatUtcTime(instantMs) })}
      </h2>
      <p className="text-muted mt-1 mb-2 max-w-prose text-small">{t("skyNote")}</p>
      <ul data-testid="sky-table" className="grid grid-cols-[84px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[84px_minmax(48px,1fr)_auto]">
        {sky.grahas.map((graha) => {
          const physical = graha.id !== "rahu" && graha.id !== "ketu";
          const retrograde = physical && graha.id !== "sun" && graha.id !== "moon" && graha.retrograde;
          return (
            <li
              key={graha.id}
              data-graha={graha.id}
              className="col-span-full grid grid-cols-subgrid items-center border-b border-rule py-1.5"
            >
              <span className="flex items-center gap-2 font-medium">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: grahaColor(graha.id) }} />
                {grahaName(graha.id)}
              </span>
              <span
                aria-hidden="true"
                className="relative hidden h-4 border-b border-rule-strong sm:block"
                style={{ backgroundImage: SCALE_BACKGROUND }}
              >
                <span
                  className="absolute -top-1 -bottom-1 -ml-px w-0.5"
                  style={{ left: `${graha.siderealLongitudeDeg / 3.6}%`, background: grahaColor(graha.id) }}
                />
              </span>
              <span className="col-start-2 text-right leading-tight tabular-nums sm:col-start-auto">
                <span className="block">
                  {graha.sign.name} {formatDegrees(graha.sign.degreeDeg)}
                  {retrograde ? (
                    <span className="font-semibold">
                      {" "}
                      {t("retrogradeShort")}
                      <span className="sr-only">, {t("retrograde")}</span>
                    </span>
                  ) : null}
                </span>
                <span className="text-muted block text-small">
                  {graha.nakshatra.name}, {t("pada", { pada: graha.nakshatra.pada })}{" "}
                  <span lang="sa">{NAKSHATRA_DEVANAGARI[graha.nakshatra.name]}</span>
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {kalaSarpa.active ? (
        <p className="mt-3 border border-rule-strong px-3 py-2 text-small">{t("kalaSarpa")}</p>
      ) : null}
    </section>
  );
}
