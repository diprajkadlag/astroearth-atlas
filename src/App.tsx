import { Suspense, lazy } from "react";

import { t } from "./i18n/index.ts";
import { EventsPanel } from "./panels/EventsPanel.tsx";
import { GreatConjunctionsPanel } from "./panels/GreatConjunctionsPanel.tsx";
import { Header } from "./panels/Header.tsx";
import { KoormaPanel, KoormaSummary } from "./panels/KoormaPanel.tsx";
import { LiveSummary, RulesPanel } from "./panels/RulesPanel.tsx";
import { SkyTable } from "./panels/SkyTable.tsx";
import { usePlayback, useUrlSync } from "./state/hooks.ts";
import { TimelineSection } from "./timeline/TimelineSection.tsx";

// three.js and the scene load in their own chunk (plan, performance budgets).
const SceneView = lazy(() => import("./scene/SceneView.tsx").then((module) => ({ default: module.SceneView })));

/** The document pages (scripts/doc-pages.ts), linked from the footer. */
const PAGES = [
  ["about", "pageAbout"],
  ["method", "pageMethod"],
  ["privacy", "pagePrivacy"],
  ["credits", "pageCredits"],
] as const;

/** Holds the scene's place while its chunk loads, so the page does not jump. */
function ScenePlaceholder({ className }: { className: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="h-[280px] bg-ground sm:h-[440px] lg:h-[560px]" />
    </div>
  );
}

/**
 * The page (DESIGN.md, layout). On a phone the order is the scene, the
 * timeline, the sky table, the Koorma Chakra with the rules, the events and
 * the great conjunctions. From 1024 px the sky table moves beside the scene,
 * the timeline spans the full width below them, the events share a row with
 * the Koorma Chakra and the rules, and the great conjunctions span the last row.
 */
export function App() {
  useUrlSync();
  usePlayback();

  return (
    <div className="mx-auto flex min-h-full max-w-[1600px] flex-col">
      <Header />
      <main className="grid gap-x-8 gap-y-6 px-4 sm:px-8 lg:grid-cols-[3fr_2fr]">
        <Suspense fallback={<ScenePlaceholder className="lg:col-start-1 lg:row-start-1" />}>
          <SceneView className="lg:col-start-1 lg:row-start-1" />
        </Suspense>
        <TimelineSection className="lg:col-span-2 lg:row-start-2" />
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">
          <SkyTable />
          <KoormaSummary className="mt-3 hidden lg:block" />
        </div>
        <div className="flex min-w-0 flex-col gap-y-6 lg:col-start-2 lg:row-start-3">
          <KoormaPanel />
          <RulesPanel />
        </div>
        <EventsPanel className="lg:col-start-1 lg:row-start-3" />
        <GreatConjunctionsPanel className="lg:col-span-2 lg:row-start-4" />
      </main>
      <LiveSummary />
      <footer className="text-muted mt-auto px-4 pt-8 pb-6 text-small sm:px-8">
        <p className="max-w-prose">{t("disclaimer")}</p>
        <p className="mt-1 max-w-prose">{t("creditsEarth")}</p>
        <nav aria-label={t("pagesNav")} className="mt-2">
          <ul className="flex flex-wrap gap-x-5">
            {PAGES.map(([file, key]) => (
              <li key={file}>
                <a href={`pages/${file}.html`} className="inline-flex min-h-11 items-center sm:min-h-8">
                  {t(key)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </footer>
    </div>
  );
}
