import { useEffect, useMemo, useRef, useState } from "react";

import { aspects, combustion, conjunctions, grahaYuddha } from "../engine/rules.ts";
import type { GrahaId } from "../engine/zodiac.ts";
import { formatDate, formatDegrees } from "../i18n/format.ts";
import { grahaName, t } from "../i18n/index.ts";
import { useSky } from "../state/hooks.ts";
import { useAtlas } from "../state/store.ts";

const ORDINALS: Readonly<Record<number, string>> = { 3: "3rd", 4: "4th", 5: "5th", 7: "7th", 8: "8th", 9: "9th", 10: "10th" };

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="border-b border-rule py-2">
      <h3 className="flex items-baseline justify-between text-small font-semibold">
        {title}
        <span className="text-muted font-normal tabular-nums">{count}</span>
      </h3>
      {count > 0 ? <ul className="mt-1 space-y-0.5 text-small">{children}</ul> : <p className="text-muted mt-1 text-small">{t("ruleNone")}</p>}
    </section>
  );
}

/**
 * The traditional rules at the date (METHOD.md, traditional rules): yuti,
 * graha yuddha, combustion and graha drishti. Rahu and Ketu cast no aspects
 * in this app.
 */
export function RulesPanel({ className = "" }: { className?: string }) {
  const { sky } = useSky();
  const grahas = sky.grahas;
  const yuti = useMemo(() => conjunctions(grahas), [grahas]);
  const war = useMemo(() => grahaYuddha(grahas), [grahas]);
  const asta = useMemo(() => combustion(grahas), [grahas]);
  const drishti = useMemo(() => aspects(grahas), [grahas]);

  // Aspects grouped by the graha that receives them.
  const received = useMemo(() => {
    const byTarget = new Map<GrahaId, { from: GrahaId; house: number }[]>();
    for (const aspect of drishti) {
      const list = byTarget.get(aspect.to) ?? [];
      list.push({ from: aspect.from, house: aspect.house });
      byTarget.set(aspect.to, list);
    }
    return [...byTarget];
  }, [drishti]);

  return (
    <div className={`min-w-0 ${className}`} data-testid="rules">
      <Section title={t("rulesConjunctions")} count={yuti.length}>
        {yuti.map((pair) => (
          <li key={`${pair.a}-${pair.b}`}>
            {t("ruleConjunction", {
              a: grahaName(pair.a),
              b: grahaName(pair.b),
              separation: formatDegrees(pair.separationDeg),
            })}
            {pair.sameSign ? <span className="text-muted"> {t("ruleSameSign")}</span> : null}
          </li>
        ))}
      </Section>
      <Section title={t("rulesWar")} count={war.length}>
        {war.map((pair) => (
          <li key={`${pair.a}-${pair.b}`}>
            {t("ruleWar", { a: grahaName(pair.a), b: grahaName(pair.b), separation: formatDegrees(pair.separationDeg) })}
          </li>
        ))}
      </Section>
      <Section title={t("rulesCombust")} count={asta.length}>
        {asta.map((item) => (
          <li key={item.id}>
            {t("ruleCombust", {
              graha: grahaName(item.id),
              separation: formatDegrees(item.separationDeg),
              orb: String(item.orbDeg),
            })}
          </li>
        ))}
      </Section>
      <details className="group border-b border-rule py-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-small font-semibold sm:min-h-0">
          <span className="flex items-center gap-2">
            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" className="transition-transform group-open:rotate-90">
              <path d="M3 1.5 L7 5 L3 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            {t("rulesAspects")}
          </span>
          <span className="text-muted font-normal tabular-nums">{drishti.length}</span>
        </summary>
        <ul className="mt-1 space-y-0.5 text-small">
          {received.map(([target, from]) => (
            <li key={target}>
              {t("ruleAspect", {
                target: grahaName(target),
                sources: from.map((item) => `${grahaName(item.from)} (${ORDINALS[item.house] ?? item.house})`).join(", "),
              })}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/**
 * A polite live region (plan, M4): a short text summary of the date for
 * screen readers, at most once per second.
 */
export function LiveSummary() {
  const instantMs = useAtlas((state) => state.instantMs);
  const playing = useAtlas((state) => state.playing);
  const { tithi, sky, kalaSarpa } = useSky();
  const [text, setText] = useState("");
  const last = useRef(0);

  const summary = useMemo(() => {
    const close = conjunctions(sky.grahas, 1).map((pair) =>
      t("liveConjunction", { a: grahaName(pair.a), b: grahaName(pair.b) }),
    );
    return [formatDate(instantMs), tithi.name, ...close, ...(kalaSarpa.active ? [t("liveKalaSarpa")] : [])].join(". ");
  }, [instantMs, tithi, sky, kalaSarpa]);

  useEffect(() => {
    // Playback changes the date many times a second: it stays quiet then.
    if (playing) return;
    const wait = Math.max(0, 1000 - (Date.now() - last.current));
    const timer = window.setTimeout(() => {
      last.current = Date.now();
      setText(summary);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [summary, playing]);

  return (
    <p className="sr-only" aria-live="polite" data-testid="live-summary">
      {text}
    </p>
  );
}
