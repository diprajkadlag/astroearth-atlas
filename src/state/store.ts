import { create } from "zustand";

import {
  DAY_MS,
  MAX_INSTANT_MS,
  clampInstant,
  clampSpan,
  followInstant,
  nearestUtcDay,
  startOfUtcDay,
  stepForSpan,
  zoomSpan,
  type Span,
} from "./dates.ts";
import { defaultView, type KoormaMode, type LaneId, type ViewSettings } from "./view.ts";

export type PlaySpeed = 1 | 10 | 100;
export const PLAY_SPEEDS: readonly PlaySpeed[] = [1, 10, 100];

export interface AtlasState extends ViewSettings {
  playing: boolean;
  /** Days per second during playback. */
  speed: PlaySpeed;

  /** Sets the date. Day-sized steps snap to 00:00 UTC (DESIGN.md, Earth motion). */
  setInstant(ms: number): void;
  /** Moves the date by whole steps of the current zoom unit. */
  stepInstant(steps: number): void;
  /** Playback: moves the date by `elapsedMs` of real time at the current speed. */
  advance(elapsedMs: number): void;
  setPlaying(playing: boolean): void;
  togglePlaying(): void;
  setSpeed(speed: PlaySpeed): void;
  setSpan(span: Span): void;
  zoom(factor: number, anchorMs: number): void;
  setLanes(lanes: LaneId[]): void;
  setKoorma(mode: KoormaMode): void;
  applyView(view: ViewSettings): void;
}

/** The date step of the current view: the zoom unit, or one second of playback. */
export function currentStepMs(state: Pick<AtlasState, "span" | "playing" | "speed">): number {
  const zoomUnit = stepForSpan(state.span.endMs - state.span.startMs);
  return state.playing ? Math.max(zoomUnit, state.speed * DAY_MS) : zoomUnit;
}

function snapToStep(ms: number, stepMs: number): number {
  return stepMs >= DAY_MS ? nearestUtcDay(ms) : Math.round(ms / 60_000) * 60_000;
}

export function createAtlasStore(initial: ViewSettings = defaultView()) {
  return create<AtlasState>()((set, get) => ({
    ...initial,
    playing: false,
    speed: 10,

    setInstant(ms) {
      const { span } = get();
      const instantMs = clampInstant(snapToStep(ms, stepForSpan(span.endMs - span.startMs)));
      set({ instantMs, span: followInstant(span, instantMs) });
    },

    stepInstant(steps) {
      const { span, instantMs } = get();
      const step = stepForSpan(span.endMs - span.startMs);
      const base = step >= DAY_MS ? startOfUtcDay(instantMs) : instantMs;
      const next = clampInstant(base + steps * step);
      set({ instantMs: next, span: followInstant(span, next), playing: false });
    },

    advance(elapsedMs) {
      const { instantMs, speed, span } = get();
      const next = clampInstant(instantMs + (elapsedMs / 1000) * speed * DAY_MS);
      const atEnd = next >= MAX_INSTANT_MS;
      set({
        instantMs: atEnd ? MAX_INSTANT_MS : next,
        span: followInstant(span, next),
        ...(atEnd ? { playing: false } : {}),
      });
    },

    setPlaying(playing) {
      const { instantMs, span } = get();
      if (playing) {
        // Playing from the last date starts again at the beginning of the span.
        const restart = instantMs >= MAX_INSTANT_MS ? span.startMs : instantMs;
        set({ playing: true, instantMs: restart });
        return;
      }
      // A paused date snaps to the zoom unit, so the Earth rule applies again.
      const unit = stepForSpan(span.endMs - span.startMs);
      set({ playing: false, instantMs: clampInstant(snapToStep(instantMs, unit)) });
    },

    togglePlaying() {
      get().setPlaying(!get().playing);
    },

    setSpeed(speed) {
      set({ speed });
    },

    setSpan(span) {
      set({ span: clampSpan(span) });
    },

    zoom(factor, anchorMs) {
      set({ span: zoomSpan(get().span, factor, anchorMs) });
    },

    setLanes(lanes) {
      if (lanes.length > 0) set({ lanes: [...lanes] });
    },

    setKoorma(koorma) {
      set({ koorma });
    },

    applyView(view) {
      set({
        instantMs: clampInstant(view.instantMs),
        span: clampSpan(view.span),
        lanes: [...view.lanes],
        koorma: view.koorma,
        playing: false,
      });
    },
  }));
}

/** The one store of the app. Tests make their own with createAtlasStore(). */
export const useAtlas = createAtlasStore();
