import { Suspense, lazy } from "react";

import { t } from "./i18n/index.ts";
import { EventsPanel } from "./panels/EventsPanel.tsx";
import { Header } from "./panels/Header.tsx";
import { LiveSummary, RulesPanel } from "./panels/RulesPanel.tsx";
import { SkyTable } from "./panels/SkyTable.tsx";
import { usePlayback, useUrlSync } from "./state/hooks.ts";
import { TimelineSection } from "./timeline/TimelineSection.tsx";

// three.js and the scene load in their own chunk (plan, performance budgets).
const SceneView = lazy(() => import("./scene/SceneView.tsx").then((module) => ({ default: module.SceneView })));

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
 * timeline, the sky table with the rules, then the events. From 1024 px the
 * sky table moves beside the scene, the timeline spans the full width below
 * them, and the events and the rules share the last row.
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
        <SkyTable className="lg:col-start-2 lg:row-start-1" />
        <RulesPanel className="lg:col-start-2 lg:row-start-3" />
        <EventsPanel className="lg:col-start-1 lg:row-start-3" />
      </main>
      <LiveSummary />
      <footer className="text-muted mt-auto px-4 pt-8 pb-6 text-small sm:px-8">
        <p className="max-w-prose">{t("disclaimer")}</p>
        <p className="mt-1 max-w-prose">{t("creditsEarth")}</p>
      </footer>
    </div>
  );
}
