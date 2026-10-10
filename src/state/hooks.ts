import { useEffect, useMemo } from "react";

import { kalaSarpa, type KalaSarpaState } from "../engine/rules.ts";
import { skyAt, type SkySnapshot } from "../engine/positions.ts";
import { tithiFromLongitudes, type Tithi } from "../engine/tithi.ts";
import { useAtlas } from "./store.ts";
import { defaultView, parseView, serializeView } from "./view.ts";

/**
 * Keeps the share link in the address bar. The link holds view settings only
 * (product rule 5). replaceState adds no history entry, so the back button
 * still leaves the app.
 */
export function useUrlSync(): void {
  useEffect(() => {
    const read = () => {
      if (window.location.hash.length > 1) {
        useAtlas.getState().applyView(parseView(window.location.hash, defaultView()));
      }
    };
    read();
    window.addEventListener("hashchange", read);

    let timer = 0;
    let written = window.location.hash;
    const unsubscribe = useAtlas.subscribe((state) => {
      // Playback and live mode change the date too often for the address bar.
      if (state.playing || state.live) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const hash = serializeView(state);
        if (hash === written) return;
        written = hash;
        window.history.replaceState(window.history.state, "", hash);
      }, 250);
    });

    return () => {
      window.removeEventListener("hashchange", read);
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}

/** Moves the date while playback runs, one step per animation frame. Live mode follows the clock. */
export function usePlayback(): void {
  const playing = useAtlas((state) => state.playing);
  const live = useAtlas((state) => state.live);

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => useAtlas.getState().tickLive(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [live]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // A long pause (a hidden tab) must not jump the date.
      const elapsed = Math.min(100, now - last);
      last = now;
      useAtlas.getState().advance(elapsed);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing]);
}

export interface SkyReading {
  instantMs: number;
  sky: SkySnapshot;
  tithi: Tithi;
  kalaSarpa: KalaSarpaState;
}

let cached: SkyReading | null = null;

/** The sky at one instant. The scene and the table share one calculation. */
export function readSky(instantMs: number): SkyReading {
  if (cached?.instantMs === instantMs) return cached;
  const sky = skyAt(new Date(instantMs));
  const longitude = (id: "sun" | "moon") =>
    sky.grahas.find((graha) => graha.id === id)?.siderealLongitudeDeg ?? 0;
  cached = {
    instantMs,
    sky,
    tithi: tithiFromLongitudes(longitude("sun"), longitude("moon")),
    kalaSarpa: kalaSarpa(sky.grahas),
  };
  return cached;
}

export function useSky(): SkyReading {
  const instantMs = useAtlas((state) => state.instantMs);
  return useMemo(() => readSky(instantMs), [instantMs]);
}
