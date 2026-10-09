import { DEG } from "../engine/angles.ts";
import { NAKSHATRA_SIZE_DEG, RASI_SIZE_DEG } from "../engine/zodiac.ts";

/** Scene sizes in Earth radii. The ring is "not to scale" (DESIGN.md, scene). */
export const EARTH_RADIUS = 1;
export const RING_RADIUS = 1.8;
export const PLATE_RADIUS = 2.3;
/** Nakshatra names sit inside the ring, sign names outside. */
export const NAKSHATRA_LABEL_RADIUS = RING_RADIUS - 0.2;
export const SIGN_LABEL_RADIUS = RING_RADIUS + 0.36;

export interface RingTicks {
  /** Line segment pairs (x, y, z, x, y, z) in the ecliptic plane. */
  degrees: Float32Array;
  nakshatras: Float32Array;
  signs: Float32Array;
  /** Closed circles as line strips: the scale's inner and outer edges. */
  inner: Float32Array;
  outer: Float32Array;
}

function radialSegments(longitudesDeg: readonly number[], fromRadius: number, toRadius: number): Float32Array {
  const out = new Float32Array(longitudesDeg.length * 6);
  longitudesDeg.forEach((longitudeDeg, index) => {
    const c = Math.cos(longitudeDeg * DEG);
    const s = Math.sin(longitudeDeg * DEG);
    out.set([fromRadius * c, fromRadius * s, 0, toRadius * c, toRadius * s, 0], index * 6);
  });
  return out;
}

function circle(radius: number, segments = 360): Float32Array {
  const out = new Float32Array((segments + 1) * 3);
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    out.set([radius * Math.cos(angle), radius * Math.sin(angle), 0], index * 3);
  }
  return out;
}

/**
 * The engraved scale of the ring: 360 degree ticks (each 5th longer), 27
 * nakshatra ticks and 12 sign ticks (the longest). All ticks point outward
 * from the ring. Longitude runs counter-clockwise seen from +Z.
 */
export function ringTicks(): RingTicks {
  const degreeTicks: number[] = [];
  const fiveDegreeTicks: number[] = [];
  for (let degree = 0; degree < 360; degree += 1) {
    (degree % 5 === 0 ? fiveDegreeTicks : degreeTicks).push(degree);
  }
  const degrees = new Float32Array([
    ...radialSegments(degreeTicks, RING_RADIUS, RING_RADIUS + 0.035),
    ...radialSegments(fiveDegreeTicks, RING_RADIUS, RING_RADIUS + 0.07),
  ]);
  const nakshatras = radialSegments(
    Array.from({ length: 27 }, (_, index) => index * NAKSHATRA_SIZE_DEG),
    RING_RADIUS - 0.06,
    RING_RADIUS + 0.12,
  );
  const signs = radialSegments(
    Array.from({ length: 12 }, (_, index) => index * RASI_SIZE_DEG),
    RING_RADIUS - 0.1,
    RING_RADIUS + 0.2,
  );
  return {
    degrees,
    nakshatras,
    signs,
    inner: circle(RING_RADIUS),
    outer: circle(RING_RADIUS + 0.1),
  };
}
