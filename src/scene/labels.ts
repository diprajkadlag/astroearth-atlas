import type { Vec3 } from "./frame.ts";

/**
 * Geometry for the 2D label layer over the 3D scene: which labels the Earth
 * hides, which lie on the far side of the ring, and how labels of close
 * grahas move apart.
 */

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * True when the Earth (a sphere at the origin) hides `point` from `camera`:
 * the line of sight meets the sphere before it reaches the point.
 */
export function isHiddenByEarth(camera: Vec3, point: Vec3, radius = 1): boolean {
  const toPoint: Vec3 = [point[0] - camera[0], point[1] - camera[1], point[2] - camera[2]];
  const distance = Math.hypot(toPoint[0], toPoint[1], toPoint[2]);
  if (distance === 0) return false;
  const direction: Vec3 = [toPoint[0] / distance, toPoint[1] / distance, toPoint[2] / distance];
  const b = dot(camera, direction);
  const c = dot(camera, camera) - radius * radius;
  const discriminant = b * b - c;
  if (discriminant < 0) return false;
  const nearest = -b - Math.sqrt(discriminant);
  return nearest > 0 && nearest < distance;
}

/** True for a point on the far half of the scene, seen from `camera`. */
export function isFarSide(camera: Vec3, point: Vec3): boolean {
  return dot(camera, point) < 0;
}

export interface PlacedLabel {
  /** Anchor on screen, in CSS pixels. */
  x: number;
  y: number;
  /** Unit direction in which the label moves away from its anchor. */
  dx: number;
  dy: number;
}

/**
 * Moves labels that would overlap: each later label steps outward along its
 * own direction until it is at least `minDistance` from every earlier one.
 * Returns the offsets in steps, so a caller can also shift a leader line.
 */
export function stackLabels(labels: readonly PlacedLabel[], minDistance: number, step = minDistance, maxSteps = 4): number[] {
  const placed: { x: number; y: number }[] = [];
  return labels.map((label) => {
    let steps = 0;
    let x = label.x;
    let y = label.y;
    const clashes = () => placed.some((other) => Math.hypot(other.x - x, other.y - y) < minDistance);
    while (steps < maxSteps && clashes()) {
      steps += 1;
      x = label.x + label.dx * step * steps;
      y = label.y + label.dy * step * steps;
    }
    placed.push({ x, y });
    return steps;
  });
}
