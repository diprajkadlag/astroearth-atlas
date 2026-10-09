import { describe, expect, it } from "vitest";

import {
  DAY_MS,
  HOUR_MS,
  MAX_INSTANT_MS,
  MIN_INSTANT_MS,
  MIN_SPAN_MS,
  followInstant,
  spanAround,
  stepForSpan,
  zoomSpan,
} from "./dates.ts";
import { createAtlasStore, currentStepMs } from "./store.ts";
import { defaultView, parseUrlInstant, parseView, serializeView, type ViewSettings } from "./view.ts";

const YEAR = 365.25 * DAY_MS;
const DEC_21_2020 = Date.UTC(2020, 11, 21);

describe("dates", () => {
  it("chooses a step that people count in", () => {
    expect(stepForSpan(150 * YEAR)).toBe(30 * DAY_MS);
    expect(stepForSpan(12 * YEAR)).toBe(7 * DAY_MS);
    expect(stepForSpan(2 * YEAR)).toBe(DAY_MS);
    expect(stepForSpan(10 * DAY_MS)).toBe(HOUR_MS);
  });

  it("keeps spans inside 1900 to 2050", () => {
    const early = spanAround(Date.UTC(1901, 0, 1), 12 * YEAR);
    expect(early.startMs).toBe(MIN_INSTANT_MS);
    const late = spanAround(Date.UTC(2050, 0, 1), 12 * YEAR);
    expect(late.endMs).toBe(MAX_INSTANT_MS);
  });

  it("pages the span forward and backward with the date", () => {
    const span = { startMs: DEC_21_2020, endMs: DEC_21_2020 + 100 * DAY_MS };
    const forward = followInstant(span, DEC_21_2020 + 150 * DAY_MS);
    expect(forward.startMs).toBe(DEC_21_2020 + 140 * DAY_MS);
    const backward = followInstant(span, DEC_21_2020 - 50 * DAY_MS);
    expect(backward.endMs).toBe(DEC_21_2020 - 40 * DAY_MS);
    expect(followInstant(span, DEC_21_2020 + DAY_MS)).toBe(span);
  });

  it("zooms around an anchor and respects the smallest span", () => {
    const span = { startMs: DEC_21_2020, endMs: DEC_21_2020 + 100 * DAY_MS };
    const anchor = DEC_21_2020 + 25 * DAY_MS;
    const zoomed = zoomSpan(span, 0.5, anchor);
    expect(zoomed.endMs - zoomed.startMs).toBe(50 * DAY_MS);
    // The anchor stays at a quarter of the span.
    expect((anchor - zoomed.startMs) / (zoomed.endMs - zoomed.startMs)).toBeCloseTo(0.25, 9);
    const tiny = zoomSpan(span, 1e-6, anchor);
    expect(tiny.endMs - tiny.startMs).toBe(MIN_SPAN_MS);
  });
});

describe("share link", () => {
  const view: ViewSettings = {
    instantMs: DEC_21_2020,
    span: { startMs: Date.UTC(2014, 11, 21), endMs: Date.UTC(2026, 11, 21) },
    lanes: ["saturn", "jupiter", "rahu"],
    koorma: "classical",
  };

  it("survives a round trip", () => {
    const hash = serializeView(view);
    expect(hash).toBe("#d=2020-12-21&from=2014-12-21&to=2026-12-21&lanes=sa,ju,ra&koorma=classical");
    expect(parseView(hash, defaultView(Date.UTC(2026, 9, 9)))).toEqual(view);
  });

  it("keeps the time of day at minute precision", () => {
    const withTime = { ...view, instantMs: Date.UTC(2020, 11, 21, 18, 26) };
    const parsed = parseView(serializeView(withTime), defaultView());
    expect(parsed.instantMs).toBe(Date.UTC(2020, 11, 21, 18, 26));
  });

  it("ignores broken values and keeps the rest", () => {
    const fallback = defaultView(Date.UTC(2026, 9, 9));
    const parsed = parseView("#d=2021-02-30&lanes=xx,ma&koorma=nowhere", fallback);
    expect(parsed.instantMs).toBe(fallback.instantMs);
    expect(parsed.lanes).toEqual(["mars"]);
    expect(parsed.koorma).toBe("global");
    expect(parseUrlInstant("1899-12-31")).toBeNull();
    expect(parseUrlInstant("2051-01-01")).toBeNull();
    expect(parseUrlInstant("2020-12-21T18:26")).toBeNull();
  });

  it("opens a span around a linked date", () => {
    const fallback = defaultView(Date.UTC(2026, 9, 9));
    const parsed = parseView("#d=1947-08-15", fallback);
    expect(parsed.instantMs).toBe(Date.UTC(1947, 7, 15));
    expect(parsed.span.startMs).toBeLessThan(parsed.instantMs);
    expect(parsed.span.endMs).toBeGreaterThan(parsed.instantMs);
  });

  it("opens on today at 00:00 UTC by default", () => {
    const view = defaultView(Date.UTC(2026, 9, 9, 15, 42));
    expect(view.instantMs).toBe(Date.UTC(2026, 9, 9));
    expect(view.lanes).toEqual(["saturn", "jupiter", "rahu", "mars", "sun"]);
    expect(view.koorma).toBe("global");
  });
});

describe("store", () => {
  function store() {
    return createAtlasStore({
      instantMs: DEC_21_2020,
      span: spanAround(DEC_21_2020, 2 * YEAR),
      lanes: ["saturn", "jupiter", "rahu", "mars", "sun"],
      koorma: "global",
    });
  }

  it("snaps day steps to 00:00 UTC", () => {
    const atlas = store();
    atlas.getState().setInstant(DEC_21_2020 + 0.7 * DAY_MS);
    expect(atlas.getState().instantMs).toBe(DEC_21_2020 + DAY_MS);
    atlas.getState().stepInstant(-3);
    expect(atlas.getState().instantMs).toBe(DEC_21_2020 - 2 * DAY_MS);
  });

  it("keeps the time of day when zoomed in to hours", () => {
    const atlas = store();
    atlas.getState().setSpan({ startMs: DEC_21_2020, endMs: DEC_21_2020 + 10 * DAY_MS });
    atlas.getState().setInstant(DEC_21_2020 + 18.5 * HOUR_MS);
    expect(atlas.getState().instantMs).toBe(DEC_21_2020 + 18.5 * HOUR_MS);
    atlas.getState().stepInstant(2);
    expect(atlas.getState().instantMs).toBe(DEC_21_2020 + 20.5 * HOUR_MS);
    expect(currentStepMs(atlas.getState())).toBe(HOUR_MS);
  });

  it("plays at the chosen speed and calls the step 1 day or more", () => {
    const atlas = store();
    atlas.getState().setSpeed(10);
    atlas.getState().setPlaying(true);
    atlas.getState().advance(500);
    expect(atlas.getState().instantMs).toBeCloseTo(DEC_21_2020 + 5 * DAY_MS, -1);
    expect(currentStepMs(atlas.getState())).toBe(10 * DAY_MS);
    atlas.getState().setPlaying(false);
    expect(atlas.getState().instantMs % DAY_MS).toBe(0);
  });

  it("stops at the last date", () => {
    const atlas = store();
    atlas.getState().setInstant(MAX_INSTANT_MS - DAY_MS);
    atlas.getState().setPlaying(true);
    atlas.getState().advance(10_000);
    expect(atlas.getState().instantMs).toBe(MAX_INSTANT_MS);
    expect(atlas.getState().playing).toBe(false);
  });
});
