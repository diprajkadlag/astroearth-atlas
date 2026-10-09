import { DailyTable, type DailyTableManifest } from "../engine/dailyTable.ts";
import type { WorkerRequest, WorkerResponse } from "./protocol.ts";
import { sampleSeries } from "./sampleSeries.ts";

/**
 * Timeline sampling off the main thread. The daily table loads once, from the
 * app's own origin. Until it arrives, or if it fails, the worker computes
 * every sample with the engine (slower, same lines within 20 arcseconds).
 */

/**
 * The members of the worker scope that this file uses. The project compiles
 * with the DOM library, whose `self` is a Window, so the worker declares them.
 */
interface WorkerScope {
  location: { origin: string };
  addEventListener(type: "message", listener: (event: MessageEvent<WorkerRequest>) => void): void;
  postMessage(message: WorkerResponse, transfer: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;
const DATA_URL = new URL(`${import.meta.env.BASE_URL}data/`, scope.location.origin);

const tableReady: Promise<DailyTable | null> = (async () => {
  try {
    const manifestResponse = await fetch(new URL("sky-daily-1900-2050.json", DATA_URL));
    const manifest = (await manifestResponse.json()) as DailyTableManifest;
    const buffer = await (await fetch(new URL(manifest.file, DATA_URL))).arrayBuffer();
    return new DailyTable(manifest, buffer);
  } catch {
    return null;
  }
})();

scope.addEventListener("message", (event) => {
  const request = event.data;
  void tableReady.then((table) => {
    let response: WorkerResponse;
    try {
      response = sampleSeries(request, table);
    } catch (error) {
      response = {
        type: "error",
        requestId: request.requestId,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    const transfer =
      response.type === "samples" ? response.series.map((series) => series.packed.buffer) : [];
    scope.postMessage(response, transfer);
  });
});
