import { secondaryButton, toggleOn } from "../design/controls.ts";
import { UI_COLORS } from "../design/palette.ts";
import { KOORMA_REGIONS, type GlowStrength, type KoormaMode, type RegionGlow } from "../engine/koorma.ts";
import { t } from "../i18n/index.ts";
import { reasonText, regionName, regionWithNakshatras } from "../i18n/koorma.ts";
import { useKoormaGlow } from "../state/hooks.ts";
import { useAtlas } from "../state/store.ts";

const MODES: readonly KoormaMode[] = ["global", "classical"];

const STRENGTH_WORDS: Readonly<Record<GlowStrength, Parameters<typeof t>[0] | null>> = {
  0: null,
  1: "koormaStrengthSoft",
  2: "koormaStrengthMiddle",
  3: "koormaStrengthStrong",
};

/** The lit regions, strongest first, in the order of the text. */
function litRegions(glow: readonly RegionGlow[]): RegionGlow[] {
  return glow
    .filter((item) => item.strength > 0)
    .sort((a, b) => b.strength - a.strength || KOORMA_REGIONS.indexOf(a.region) - KOORMA_REGIONS.indexOf(b.region));
}

/**
 * The swatch of a glow strength (DESIGN.md, Koorma glow). The shape differs
 * as well as the colour: a filled disc for an eclipse (eclipse ivory) and for
 * the middle strength (brass), a brass ring for a transit.
 */
function StrengthSwatch({ strength }: { strength: GlowStrength }) {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" className="mt-1 shrink-0">
      {strength === 1 ? (
        <circle cx="7" cy="7" r="5" fill="none" stroke={UI_COLORS.brass} strokeWidth="2" />
      ) : (
        <circle cx="7" cy="7" r="6" fill={strength === 3 ? UI_COLORS.eclipse : UI_COLORS.brass} />
      )}
    </svg>
  );
}

/**
 * The Koorma Chakra beside the scene: the mode switch, the regions that glow
 * at the date with their reasons, and the key to the 3 strengths. It is also
 * the text alternative of the glow on the globe.
 */
export function KoormaPanel({ className = "" }: { className?: string }) {
  const mode = useAtlas((state) => state.koorma);
  const setKoorma = useAtlas((state) => state.setKoorma);
  const glow = useKoormaGlow();
  const lit = litRegions(glow);

  return (
    <section aria-labelledby="koorma-title" className={`min-w-0 ${className}`} data-testid="koorma">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="koorma-title" tabIndex={-1} className="font-display text-title-2 outline-none">
          {t("koormaTitle")}
        </h2>
        <div role="group" aria-label={t("koormaModeLabel")} className="flex gap-2">
          {MODES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => setKoorma(option)}
              className={`${secondaryButton} ${mode === option ? toggleOn : ""}`}
            >
              {t(option === "global" ? "koormaGlobal" : "koormaClassical")}
            </button>
          ))}
        </div>
      </div>
      <p className="text-muted mt-1 max-w-prose text-small">
        {t(mode === "global" ? "koormaGlobalNote" : "koormaClassicalNote")}
      </p>

      <h3 className="mt-3 text-small font-semibold">{t("koormaLitTitle")}</h3>
      {lit.length > 0 ? (
        <ul className="mt-1" data-testid="koorma-lit">
          {lit.map((item) => (
            <li
              key={item.region.id}
              data-region={item.region.id}
              data-strength={item.strength}
              className="flex gap-2 border-b border-rule py-1.5"
            >
              <StrengthSwatch strength={item.strength} />
              <div className="min-w-0">
                <p className="font-medium">
                  <span className="sr-only">{t(STRENGTH_WORDS[item.strength] ?? "koormaStrengthSoft")} </span>
                  {regionWithNakshatras(item.region)}
                </p>
                <ul className="text-muted text-small">
                  {item.reasons.map((reason, index) => (
                    <li key={index}>{reasonText(reason)}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted mt-1 text-small">{t("koormaNoneLit")}</p>
      )}

      <h3 className="mt-3 text-small font-semibold">{t("koormaKeyTitle")}</h3>
      <ul className="mt-1 space-y-1 text-small">
        {([3, 2, 1] as const).map((strength) => (
          <li key={strength} className="flex gap-2">
            <StrengthSwatch strength={strength} />
            <span>{t(strength === 3 ? "koormaKeyEclipse" : strength === 2 ? "koormaKeyMiddle" : "koormaKeySoft")}</span>
          </li>
        ))}
      </ul>
      <p className="text-muted mt-2 text-small">{t("koormaPointHint")}</p>
      <p className="mt-1 text-small">
        <a href="pages/method.html#koorma-chakra">{t("koormaMethodLink")}</a>
      </p>
    </section>
  );
}

const KIND_WORDS: Readonly<Record<RegionGlow["reasons"][number]["kind"], Parameters<typeof t>[0]>> = {
  eclipse: "koormaKindEclipse",
  station: "koormaKindStation",
  retrograde: "koormaKindRetrograde",
  transit: "koormaKindTransit",
};

/**
 * One line under the sky table on desktop: the lit regions and the kind of
 * their strongest reason, so the glow reads without scrolling to the panel.
 */
export function KoormaSummary({ className = "" }: { className?: string }) {
  const lit = litRegions(useKoormaGlow());
  const showPanel = () => {
    const heading = document.getElementById("koorma-title");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    heading?.focus({ preventScroll: true });
  };
  if (lit.length === 0) return null;
  return (
    <p className={`text-small ${className}`} data-testid="koorma-summary">
      <span className="font-semibold">{t("koormaTitle")}:</span>{" "}
      {lit
        .map((item) =>
          t("koormaSummaryItem", {
            region: item.region.id === "centre" ? t("koormaRegionCentreShort") : regionName(item.region.id),
            kind: t(KIND_WORDS[item.reasons[0]?.kind ?? "transit"]),
          }),
        )
        .join(", ")}
      .{" "}
      <button type="button" onClick={showPanel} className="underline decoration-rule-strong underline-offset-2 hover:decoration-ivory">
        {t("koormaSummaryButton")}
      </button>
    </p>
  );
}
