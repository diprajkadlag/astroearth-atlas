import type { MessageKey } from "../i18n/en.ts";

/**
 * Sky moments: dates with a notable pattern in the sky, shown as shortcuts.
 * Each one is a calculated fact, and tests/presets.test.ts checks it with the
 * engine. No preset claims an effect on world events.
 */
export interface SkyMoment {
  id: string;
  title: MessageKey;
  instantMs: number;
}

export const SKY_MOMENTS: readonly SkyMoment[] = [
  // Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn and Ketu in Capricorn, on the day of a total solar eclipse.
  { id: "eight-in-capricorn-1962", title: "momentEightCapricorn", instantMs: Date.UTC(1962, 1, 5) },
  // Sun, Moon, Mercury, Jupiter, Saturn and Ketu in Sagittarius, on the day of an annular solar eclipse.
  { id: "six-in-sagittarius-2019", title: "momentSixSagittarius", instantMs: Date.UTC(2019, 11, 26) },
  // The conjunction of Jupiter and Saturn in Capricorn (exact instant from the great-conjunction search).
  { id: "great-conjunction-2020", title: "momentGreatConjunction", instantMs: Date.UTC(2020, 11, 21, 18, 26) },
];
