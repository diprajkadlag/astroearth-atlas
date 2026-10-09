import { t } from "./i18n/index.ts";

/**
 * Application shell. The regions match the planned layout: Earth and sky,
 * the sky table, and the timeline. The visual design is chosen in milestone
 * M2 and written down in DESIGN.md, so this shell stays deliberately plain.
 */
export function App() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="px-4 pt-6 pb-4 sm:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("appName")}</h1>
        <p className="text-muted mt-1 max-w-prose text-sm">{t("tagline")}</p>
      </header>

      <main className="grid flex-1 gap-4 px-4 pb-6 sm:px-8 lg:grid-cols-[2fr_1fr]">
        <section
          aria-labelledby="globe-title"
          className="min-w-0 rounded-md border border-white/10 p-4"
        >
          <h2 id="globe-title" className="text-base font-medium">
            {t("globeTitle")}
          </h2>
          <p className="text-muted mt-2 text-sm">{t("inDevelopment")}</p>
        </section>

        <section
          aria-labelledby="sky-title"
          className="min-w-0 rounded-md border border-white/10 p-4"
        >
          <h2 id="sky-title" className="text-base font-medium">
            {t("skyTitle")}
          </h2>
          <p className="text-muted mt-2 text-sm">{t("inDevelopment")}</p>
        </section>

        <section
          aria-labelledby="timeline-title"
          className="min-w-0 rounded-md border border-white/10 p-4 lg:col-span-2"
        >
          <h2 id="timeline-title" className="text-base font-medium">
            {t("timelineTitle")}
          </h2>
          <p className="text-muted mt-2 text-sm">{t("inDevelopment")}</p>
        </section>
      </main>

      <footer className="text-muted px-4 pt-2 pb-6 text-sm sm:px-8">
        <p className="max-w-prose">{t("disclaimer")}</p>
      </footer>
    </div>
  );
}
