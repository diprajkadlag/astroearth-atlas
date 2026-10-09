import { useEffect, useRef, useState } from "react";

import type { GrahaId } from "../engine/zodiac.ts";
import type { SampleRequest, SeriesSamples, WorkerResponse } from "../worker/protocol.ts";

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

export interface SampleSet {
  startMs: number;
  endMs: number;
  columns: number;
  series: Map<GrahaId, SeriesSamples>;
}

/**
 * Drawable lines for `ids` over [startMs, endMs] at `columns` pixel columns.
 * Only the newest request counts: an answer to an older request is dropped.
 */
export function useSamples(ids: readonly GrahaId[], startMs: number, endMs: number, columns: number): SampleSet | null {
  const [samples, setSamples] = useState<SampleSet | null>(null);
  const latest = useRef(0);
  const key = ids.join(",");

  useEffect(() => {
    if (columns < 1 || !(endMs > startMs)) return;
    const requestId = nextRequestId++;
    latest.current = requestId;
    // Wait for a short pause in zooming or resizing before asking.
    const timer = window.setTimeout(() => {
      listeners.set(requestId, (response) => {
        if (latest.current !== requestId || response.type !== "samples") return;
        setSamples({
          startMs,
          endMs,
          columns,
          series: new Map(response.series.map((series) => [series.id, series])),
        });
      });
      const request: SampleRequest = {
        type: "sample",
        requestId,
        ids: key.split(",") as GrahaId[],
        startMs,
        endMs,
        columns,
      };
      sampler().postMessage(request);
    }, 40);
    return () => {
      window.clearTimeout(timer);
      listeners.delete(requestId);
    };
  }, [key, startMs, endMs, columns]);

  return samples;
}
