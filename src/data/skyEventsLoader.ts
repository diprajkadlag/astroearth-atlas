import { useSyncExternalStore } from "react";

import { parseSkyEvents, type SkyEvents } from "./skyEvents.ts";

/**
 * Loads the sky event files once, after the page, from the app's own origin.
 * Kept apart from skyEvents.ts, so unit tests can parse the files in Node.
 */

type RawFiles = Parameters<typeof parseSkyEvents>;

let loaded: SkyEvents | null = null;
let loading: Promise<SkyEvents | null> | null = null;
const listeners = new Set<() => void>();

/** Starts the one load of the event files. Later calls share it. */
export function loadSkyEvents(): Promise<SkyEvents | null> {
  loading ??= (async () => {
    try {
      const base = `${import.meta.env.BASE_URL}data/`;
      const [raw, great] = await Promise.all([
        fetch(`${base}sky-events-1900-2050.json`).then((response) => response.json() as Promise<RawFiles[0]>),
        fetch(`${base}great-conjunctions-1000-2100.json`).then((response) => response.json() as Promise<RawFiles[1]>),
      ]);
      loaded = parseSkyEvents(raw, great);
      listeners.forEach((listener) => listener());
      return loaded;
    } catch {
      // Without the files the timeline still draws the lanes; only the marks are missing.
      return null;
    }
  })();
  return loading;
}

/** The current events, for code outside React (the scene's frame loop). */
export function skyEventsNow(): SkyEvents | null {
  return loaded;
}

/** The sky events, or null while they load. */
export function useSkyEvents(): SkyEvents | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      void loadSkyEvents();
      return () => listeners.delete(listener);
    },
    () => loaded,
    () => null,
  );
}
