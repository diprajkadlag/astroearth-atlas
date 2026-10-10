import { useSyncExternalStore } from "react";

/**
 * The place on the globe under the pointer, for the Koorma tooltip. The scene
 * writes it from its pointer events; the tooltip reads it. It lives outside
 * React state, so a pointer move does not render the whole scene section.
 */
export interface GlobeHover {
  /** Pointer position inside the scene box, in CSS pixels. */
  x: number;
  y: number;
  /** Size of the scene box, so the tooltip can stay inside it. */
  width: number;
  height: number;
  latitudeDeg: number;
  longitudeDeg: number;
}

let current: GlobeHover | null = null;
const listeners = new Set<() => void>();

export function setGlobeHover(value: GlobeHover | null): void {
  if (value === null && current === null) return;
  current = value;
  listeners.forEach((listener) => listener());
}

export function useGlobeHover(): GlobeHover | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null,
  );
}
