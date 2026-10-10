import { create } from "zustand";

import {
  DAY_MS,
  MAX_INSTANT_MS,
  clampInstant,
  clampSpan,
  followInstant,
  nearestUtcDay,
  spanAround,
  startOfUtcDay,
  stepForSpan,
  zoomSpan,
  type Span,
} from "./dates.ts";
import {
  MAX_CYCLE_PAIRS,
  defaultView,
  type CyclePair,
  type KoormaMode,
  type LaneId,
  type TimelineView,
  type ViewSettings,
} from "./view.ts";

export type PlaySpeed = 1 | 10 | 100;
export const PLAY_SPEEDS: readonly PlaySpeed[] = [1, 10, 100];

export interface AtlasState extends ViewSettings {
  playing: boolean;
  /** Days per second during playback. */
  speed: PlaySpeed;
  /** Live mode: the date follows the clock. */
  live: boolean;
  /**
   * True when the date is an event's own time (a jump to an event or live
   * mode). The date is not snapped, and the Earth shows the true time of day.
   */
  exact: boolean;

  /** Sets the date. Day-sized steps snap to 00:00 UTC (DESIGN.md, Earth motion). */
  setInstant(ms: number): void;
  /** Moves the date by whole steps of the current zoom unit. */
  stepInstant(steps: number): void;
  /** Jumps to an instant and centres the view on it at the same zoom (plan, M4). */
  jumpTo(ms: number, options?: { exact?: boolean; eventId?: string | null }): void;
  /** Playback: moves the date by `elapsedMs` of real time at the current speed. */
  advance(elapsedMs: number): void;
  setPlaying(playing: boolean): void;
  togglePlaying(): void;
  setSpeed(speed: PlaySpeed): void;
  setLive(live: boolean): void;
  /** Live mode: sets the date to the clock without snapping. */
  tickLive(nowMs: number): void;
  setSpan(span: Span): void;
  panSpan(deltaMs: number): void;
  zoom(factor: number, anchorMs: number): void;
  setLanes(lanes: LaneId[]): void;
  setKoorma(mode: KoormaMode): void;
  setView(view: TimelineView): void;
  setPairs(pairs: CyclePair[]): void;
  selectEvent(eventId: string | null): void;
  applyView(view: ViewSettings): void;
}

/**
 * The date step that decides how the Earth turns (DESIGN.md, Earth motion):
 * the zoom unit, or one second of playback. Live mode and event jumps show
 * the true time, so their step is under 1 day.
 */
export function currentStepMs(state: Pick<AtlasState, "span" | "playing" | "speed" | "live" | "exact">): number {
  if (state.live) return 1000;
  const zoomUnit = stepForSpan(state.span.endMs - state.span.startMs);
  if (state.playing) return Math.max(zoomUnit, state.speed * DAY_MS);
  if (state.exact) return 60_000;
  return zoomUnit;
}

function snapToStep(ms: number, stepMs: number): number {
  return stepMs >= DAY_MS ? nearestUtcDay(ms) : Math.round(ms / 60_000) * 60_000;
}

export function createAtlasStore(initial: ViewSettings = defaultView()) {
  return create<AtlasState>()((set, get) => ({
    ...initial,
    playing: false,
    speed: 10,
    live: false,
    exact: false,

    setInstant(ms) {
      const { span } = get();
      const instantMs = clampInstant(snapToStep(ms, stepForSpan(span.endMs - span.startMs)));
      set({ instantMs, span: followInstant(span, instantMs), live: false, exact: false });
    },

    stepInstant(steps) {
      const { span, instantMs } = get();
      const step = stepForSpan(span.endMs - span.startMs);
      const base = step >= DAY_MS ? startOfUtcDay(instantMs) : instantMs;
      const next = clampInstant(base + steps * step);
      set({ instantMs: next, span: followInstant(span, next), playing: false, live: false, exact: false });
    },

    jumpTo(ms, options = {}) {
      const { span } = get();
      const length = span.endMs - span.startMs;
      const exact = options.exact ?? false;
      const instantMs = clampInstant(exact ? ms : snapToStep(ms, stepForSpan(length)));
      set({
        instantMs,
        span: spanAround(instantMs, length),
        playing: false,
        live: false,
        exact,
        ...(options.eventId !== undefined ? { eventId: options.eventId } : {}),
      });
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
        set({ playing: true, live: false, exact: false, instantMs: restart });
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

    setLive(live) {
      if (!live) {
        set({ live: false, exact: false });
        return;
      }
      const { span } = get();
      const instantMs = clampInstant(Date.now());
      set({
        live: true,
        exact: true,
        playing: false,
        instantMs,
        span: spanAround(instantMs, span.endMs - span.startMs),
      });
    },

    tickLive(nowMs) {
      const { live, span } = get();
      if (!live) return;
      const instantMs = clampInstant(nowMs);
      set({ instantMs, span: followInstant(span, instantMs) });
    },

    setSpan(span) {
      set({ span: clampSpan(span) });
    },

    panSpan(deltaMs) {
      const { span } = get();
      set({ span: clampSpan({ startMs: span.startMs + deltaMs, endMs: span.endMs + deltaMs }) });
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

    setView(view) {
      set({ view });
    },

    setPairs(pairs) {
      if (pairs.length > 0) set({ pairs: pairs.slice(0, MAX_CYCLE_PAIRS) });
    },

    selectEvent(eventId) {
      set({ eventId });
    },

    applyView(view) {
      set({
        instantMs: clampInstant(view.instantMs),
        span: clampSpan(view.span),
        lanes: [...view.lanes],
        koorma: view.koorma,
        view: view.view,
        pairs: [...view.pairs],
        eventId: view.eventId,
        playing: false,
        live: false,
        // A linked time of day (not 00:00 UTC) is shown as it is.
        exact: view.instantMs % DAY_MS !== 0,
      });
    },
  }));
}

/** The one store of the app. Tests make their own with createAtlasStore(). */
export const useAtlas = createAtlasStore();
