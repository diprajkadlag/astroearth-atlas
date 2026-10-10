import { describe, expect, it } from "vitest";

import { EVENT_CATEGORIES, WORLD_EVENTS, eventDayMs, eventInstantMs } from "../src/data/worldEvents.ts";

const FORMATS = {
  month: /^\d{4}-\d{2}$/,
  day: /^\d{4}-\d{2}-\d{2}$/,
  minute: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/,
} as const;

/** Words that would claim a link between the sky and the event (product rule 1). */
const BANNED = /\bpredict|\bforecast|\bastrolog|\bomens?\b|\bforetold\b|caused by the (planets|stars)/i;

/** One Wikidata item that covers 2 listed stages of the same event (the COVID-19 pandemic). */
const SHARED_ITEMS = new Set(["Q81068910"]);

describe("world events", () => {
  it("hold the curated list of about 90 events", () => {
    expect(WORLD_EVENTS.length).toBeGreaterThanOrEqual(80);
  });

  it("have unique kebab-case ids that end in the start year", () => {
    const ids = WORLD_EVENTS.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const event of WORLD_EVENTS) {
      expect(event.id, event.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*-\d{4}$/);
      expect(event.id.slice(-4), event.id).toBe(event.start.slice(0, 4));
    }
  });

  it("have dates in their precision, from 1900 up to today, in order", () => {
    let previous = -Infinity;
    for (const event of WORLD_EVENTS) {
      expect(event.start, event.id).toMatch(FORMATS[event.precision]);
      const ms = eventInstantMs(event);
      expect(Number.isFinite(ms), event.id).toBe(true);
      expect(ms, event.id).toBeGreaterThanOrEqual(Date.UTC(1900, 0, 1) - 86_400_000);
      expect(ms, event.id).toBeLessThanOrEqual(Date.now());
      // A day date must exist (no 30 February).
      if (event.precision === "day") {
        const [year, month, day] = event.start.split("-").map(Number) as [number, number, number];
        const date = new Date(Date.UTC(year, month - 1, day));
        expect(date.getUTCDate(), event.id).toBe(day);
      }
      expect(ms, `${event.id} is out of order`).toBeGreaterThanOrEqual(previous);
      previous = ms;
    }
  });

  it("have neutral titles and short summaries in own words", () => {
    for (const event of WORLD_EVENTS) {
      expect(event.title.length, event.id).toBeLessThanOrEqual(90);
      expect(event.title, event.id).toMatch(/^[A-Z0-9]/);
      expect(event.title.endsWith("."), event.id).toBe(false);
      expect(event.summary.length, event.id).toBeLessThanOrEqual(160);
      expect(event.summary.endsWith("."), event.id).toBe(true);
      expect(`${event.title} ${event.summary}`, event.id).not.toMatch(BANNED);
    }
  });

  it("have a known category, a checked source and valid places", () => {
    const seen = new Map<string, string>();
    for (const event of WORLD_EVENTS) {
      expect(EVENT_CATEGORIES, event.id).toContain(event.category);
      expect(Boolean(event.wikidata || event.source), `${event.id} needs a Wikidata item or an official source`).toBe(true);
      if (event.wikidata) {
        expect(event.wikidata, event.id).toMatch(/^Q\d+$/);
        const other = seen.get(event.wikidata);
        if (!SHARED_ITEMS.has(event.wikidata)) {
          expect(other, `${event.id} shares ${event.wikidata} with ${other}`).toBeUndefined();
        }
        seen.set(event.wikidata, event.id);
      }
      if (event.source) expect(event.source, event.id).toMatch(/^https:\/\/[a-z0-9.-]+\//);
      if (event.place) {
        expect(event.place.name.length, event.id).toBeGreaterThan(0);
        expect(Math.abs(event.place.latitudeDeg), event.id).toBeLessThanOrEqual(90);
        expect(Math.abs(event.place.longitudeDeg), event.id).toBeLessThanOrEqual(180);
      }
    }
  });

  it("give no place to a war fought over a wide area (METHOD.md)", () => {
    // A pin in a disputed region would be the only map statement of a borderless globe.
    const wars = ["ww1-start-1914", "ww2-start-1939", "korean-war-1950", "indo-pak-war-1947", "indo-pak-war-1965", "indo-pak-war-1971"];
    for (const id of wars) {
      const event = WORLD_EVENTS.find((item) => item.id === id);
      expect(event, id).toBeDefined();
      expect(event?.place, id).toBeUndefined();
    }
  });

  it("never matches the banned words by accident", () => {
    // "women" and "moment" contain "omen"; the word boundary keeps them legal.
    expect("women at the moment").not.toMatch(BANNED);
    expect("an omen").toMatch(BANNED);
  });
});

describe("event dates on screen", () => {
  it("keep the local date of a day event: its shown instant falls on the same UTC date", () => {
    // A card shows the local date. Local noon at any longitude stays on that UTC date,
    // so 15 August 1947 in New Delhi never reads as 14 August.
    for (const event of WORLD_EVENTS.filter((item) => item.precision === "day")) {
      expect(new Date(eventInstantMs(event)).toISOString().slice(0, 10), event.id).toBe(event.start);
    }
  });
});

describe("event time rule", () => {
  it("uses the stated UTC time for minute precision", () => {
    expect(eventInstantMs({ start: "1969-07-20T20:17Z", precision: "minute" })).toBe(Date.UTC(1969, 6, 20, 20, 17));
  });

  it("uses local mean noon at the place for day precision", () => {
    // Bhopal, 77.40 E: noon local mean time is 5 h 9.6 min before 12:00 UTC.
    const place = { name: "Bhopal", latitudeDeg: 23.26, longitudeDeg: 77.4 };
    const ms = eventInstantMs({ start: "1984-12-03", precision: "day", place });
    expect(ms).toBe(Date.UTC(1984, 11, 3, 12) - (77.4 / 15) * 3_600_000);
    const day = eventDayMs({ start: "1984-12-03", precision: "day", place });
    expect(day?.endMs).toBe(ms + 12 * 3_600_000);
  });

  it("uses 12:00 UTC without a place, and the 1st for month precision", () => {
    expect(eventInstantMs({ start: "1989-11-09", precision: "day" })).toBe(Date.UTC(1989, 10, 9, 12));
    expect(eventInstantMs({ start: "1918-03", precision: "month" })).toBe(Date.UTC(1918, 2, 1, 12));
  });
});
