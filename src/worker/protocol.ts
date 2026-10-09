import type { GrahaId } from "../engine/zodiac.ts";

/** Messages between the timeline and src/worker/sky.worker.ts. */

export interface SampleRequest {
  type: "sample";
  requestId: number;
  ids: GrahaId[];
  startMs: number;
  endMs: number;
  /** Pixel columns of the lane. */
  columns: number;
}

export interface SeriesSamples {
  id: GrahaId;
  /** x (milliseconds) and y (sidereal degrees) pairs, NaN pairs between pieces. */
  packed: Float64Array;
  source: "daily-table" | "computed";
}

export interface SampleResponse {
  type: "samples";
  requestId: number;
  series: SeriesSamples[];
}

export interface ErrorResponse {
  type: "error";
  requestId: number;
  message: string;
}

export type WorkerRequest = SampleRequest;
export type WorkerResponse = SampleResponse | ErrorResponse;
