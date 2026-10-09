import { useState } from "react";

import { formatDate, formatDegrees, formatUtcTime } from "../i18n/format.ts";
import { t } from "../i18n/index.ts";
import { useSky } from "../state/hooks.ts";
import { useAtlas } from "../state/store.ts";

/** The title, and the date as the largest text of the page (DESIGN.md, type). */
export function Header() {
  const instantMs = useAtlas((state) => state.instantMs);
  const { sky, tithi } = useSky();
  // Product rule 2: a future date shows calculated positions only.
  const [openedAt] = useState(() => Date.now());
  const future = instantMs > openedAt;

  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 px-4 pt-6 pb-4 sm:px-8">
      <div>
        <h1 className="font-display text-title-2 sm:text-title-1">{t("appName")}</h1>
        <p className="text-muted mt-1 max-w-prose text-small">{t("tagline")}</p>
      </div>
      <div className="sm:text-right" aria-live="off">
        <p className="font-display text-title-1 tabular-nums sm:text-date" data-testid="current-date">
          {formatDate(instantMs)}
        </p>
        <p className="mt-1 text-lead">
          {tithi.name}
          <span className="text-muted">
            {" "}
            {formatUtcTime(instantMs)}, {t("ayanamsa", { value: formatDegrees(sky.ayanamsa.trueDegrees) })}
          </span>
        </p>
        {future ? <p className="mt-1 text-small text-brass">{t("futureBanner")}</p> : null}
      </div>
    </header>
  );
}
