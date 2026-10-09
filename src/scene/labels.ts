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

export interface LabelRequest {
  /** Preferred position on screen, in CSS pixels. */
  x: number;
  y: number;
  /** Unit direction in which the label may move away from its mark. */
  dx: number;
  dy: number;
  /** Half the text width, in CSS pixels. */
  halfWidth: number;
}

export interface LabelBounds {
  width: number;
  height: number;
}

/**
 * Places labels so that they neither overlap nor leave the canvas. Each label
 * tries its preferred place, then steps outward along its own direction, then
 * steps sideways. A label that finds no free place keeps the nearest place
 * inside the canvas. Earlier labels win.
 */
export function placeLabels(
  labels: readonly LabelRequest[],
  bounds: LabelBounds,
  minDistance: number,
  step = minDistance,
): { x: number; y: number }[] {
  const margin = 4;
  const placed: { x: number; y: number }[] = [];
  const inside = (label: LabelRequest, x: number, y: number) =>
    x - label.halfWidth >= margin &&
    x + label.halfWidth <= bounds.width - margin &&
    y >= 8 &&
    y <= bounds.height - 8;
  const free = (x: number, y: number) =>
    placed.every((other) => Math.hypot(other.x - x, other.y - y) >= minDistance);

  return labels.map((label) => {
    const candidates: [number, number][] = [];
    for (let out = 0; out <= 3; out += 1) candidates.push([out, 0]);
    for (let side = 1; side <= 3; side += 1) {
      for (const out of [0, 1]) candidates.push([out, side], [out, -side]);
    }
    let chosen: { x: number; y: number } | null = null;
    for (const [out, side] of candidates) {
      const x = label.x + label.dx * step * out - label.dy * step * side;
      const y = label.y + label.dy * step * out + label.dx * step * side;
      if (inside(label, x, y) && free(x, y)) {
        chosen = { x, y };
        break;
      }
    }
    chosen ??= {
      x: Math.min(bounds.width - margin - label.halfWidth, Math.max(margin + label.halfWidth, label.x)),
      y: Math.min(bounds.height - 8, Math.max(8, label.y)),
    };
    placed.push(chosen);
    return chosen;
  });
}
