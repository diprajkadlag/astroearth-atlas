import { useEffect, useRef, useState } from "react";

import type { GrahaId } from "../engine/zodiac.ts";
import type {
  CycleRequest,
  CycleSeries,
  SampleRequest,
  SeriesSamples,
  WorkerRequest,
  WorkerResponse,
} from "../worker/protocol.ts";

let worker: Worker | null = null;
let nextRequestId = 1;
const listeners = new Map<number, (response: WorkerResponse) => void>();

/** One worker for the whole app. It loads the daily table once. */
function sampler(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../worker/sky.worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      const listener = listeners.get(event.data.requestId);
      if (!listener) return;
      listeners.delete(event.data.requestId);
      listener(event.data);
    });
  }
  return worker;
}

/**
 * Sends one request after a short pause (zooming and resizing send many) and
 * keeps only the newest answer. Returns a cancel function.
 */
function schedule(build: (requestId: number) => WorkerRequest, onAnswer: (response: WorkerResponse) => void): () => void {
  const requestId = nextRequestId++;
  const timer = window.setTimeout(() => {
    listeners.set(requestId, onAnswer);
    sampler().postMessage(build(requestId));
  }, 40);
  return () => {
    window.clearTimeout(timer);
    listeners.delete(requestId);
  };
}

export interface SampleSet {
  startMs: number;
  endMs: number;
  columns: number;
  series: Map<GrahaId, SeriesSamples>;
}

/** Drawable lane lines for `ids` over [startMs, endMs] at `columns` pixel columns. */
export function useSamples(ids: readonly GrahaId[], startMs: number, endMs: number, columns: number): SampleSet | null {
  const [samples, setSamples] = useState<SampleSet | null>(null);
  const latest = useRef(0);
  const key = ids.join(",");

  useEffect(() => {
    if (columns < 1 || !(endMs > startMs) || key === "") return;
    const token = ++latest.current;
    return schedule(
      (requestId): SampleRequest => ({
        type: "sample",
        requestId,
        ids: key.split(",") as GrahaId[],
        startMs,
        endMs,
        columns,
      }),
      (response) => {
        if (latest.current !== token || response.type !== "samples") return;
        setSamples({ startMs, endMs, columns, series: new Map(response.series.map((series) => [series.id, series])) });
      },
    );
  }, [key, startMs, endMs, columns]);

  return samples;
}

export interface CycleSet {
  startMs: number;
  endMs: number;
  series: Map<string, CycleSeries>;
}

/** Cycles lines (cosine of the angle between 2 grahas) for each pair. */
export function useCycleSamples(
  pairs: readonly [GrahaId, GrahaId][],
  startMs: number,
  endMs: number,
  columns: number,
): CycleSet | null {
  const [samples, setSamples] = useState<CycleSet | null>(null);
  const latest = useRef(0);
  const key = pairs.map((pair) => pair.join("-")).join(",");

  useEffect(() => {
    if (columns < 1 || !(endMs > startMs) || key === "") return;
    const token = ++latest.current;
    return schedule(
      (requestId): CycleRequest => ({
        type: "cycles",
        requestId,
        pairs: key.split(",").map((pair) => pair.split("-") as [GrahaId, GrahaId]),
        startMs,
        endMs,
        columns,
      }),
      (response) => {
        if (latest.current !== token || response.type !== "cycles") return;
        setSamples({ startMs, endMs, series: new Map(response.series.map((series) => [series.pair, series])) });
      },
    );
  }, [key, startMs, endMs, columns]);

  return samples;
}
