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

/** The Cycles view: cos(longitude of a minus longitude of b) for each pair. */
export interface CycleRequest {
  type: "cycles";
  requestId: number;
  pairs: [GrahaId, GrahaId][];
  startMs: number;
  endMs: number;
  columns: number;
}

export interface CycleSeries {
  /** "a-b", for example "jupiter-saturn". */
  pair: string;
  /** x (milliseconds) and y (cosine, -1 to 1) pairs. */
  packed: Float64Array;
}

export interface CycleResponse {
  type: "cycles";
  requestId: number;
  series: CycleSeries[];
}

export type WorkerRequest = SampleRequest | CycleRequest;
export type WorkerResponse = SampleResponse | CycleResponse | ErrorResponse;
