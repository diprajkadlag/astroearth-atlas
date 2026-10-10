import { Canvas, useThree } from "@react-three/fiber";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { UI_COLORS } from "../design/palette.ts";
import { formatDate } from "../i18n/format.ts";
import { t } from "../i18n/index.ts";
import { useAtlas } from "../state/store.ts";
import { SkyScene, type ViewApi } from "./SkyScene.tsx";
import { probeWebGLCapability, type WebGLCapability } from "./webgl-capability.ts";
import { getWebGLRecoveryDelay } from "./webgl-recovery.ts";

class SceneErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onError: () => void },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(): void {
    this.props.onError();
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Watches the WebGL context for as long as this canvas owns it. A lost
 * context may come back by itself. If it does not, the parent remounts the
 * canvas, within the retry budget of webgl-recovery.ts.
 */
function ContextLossMonitor({ onLost, onRestored }: { onLost: () => void; onRestored: () => void }) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      // Without preventDefault the browser never restores the context.
      event.preventDefault();
      onLost();
    };
    const restored = () => {
      gl.resetState();
      invalidate();
      onRestored();
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
    };
  }, [gl, invalidate, onLost, onRestored]);
  return null;
}

const coarsePointerQuery = "(pointer: coarse)";

function subscribeToPointer(onChange: () => void): () => void {
  const query = window.matchMedia(coarsePointerQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribeToPointer,
    () => window.matchMedia(coarsePointerQuery).matches,
    () => false,
  );
}

function subscribeToFullscreen(onChange: () => void): () => void {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

/** The element in fullscreen, kept current from the browser's events. */
function useFullscreenElement(): Element | null {
  return useSyncExternalStore(subscribeToFullscreen, () => document.fullscreenElement, () => null);
}

function Fallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-start justify-center gap-3 p-6">
      <p className="font-display text-title-3">{t("webglUnavailableTitle")}</p>
      <p className="text-muted max-w-prose text-small">{t("webglUnavailableBody")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-control border border-rule-strong px-4 py-2 text-small hover:border-ivory"
      >
        {t("webglRetry")}
      </button>
    </div>
  );
}

const TURN_KEYS: Readonly<Record<string, [number, number]>> = {
  ArrowLeft: [-10, 0],
  ArrowRight: [10, 0],
  ArrowUp: [0, 5],
  ArrowDown: [0, -5],
};

/** The scene section: the WebGL canvas, the label layer, and their fallbacks. */
export function SceneView({ className = "" }: { className?: string }) {
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const fullscreenElement = useFullscreenElement();
  // The scene box carries data-testid="scene"; reading the ref during render is not allowed.
  const fullscreen = fullscreenElement?.getAttribute("data-testid") === "scene";
  const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled;
  const apiRef = useRef<ViewApi | null>(null);
  // Checks support before React Three Fiber builds a renderer.
  const [capability, setCapability] = useState<WebGLCapability>(() => probeWebGLCapability());
  const [mount, setMount] = useState(0);
  const [lost, setLost] = useState(false);
  const recoveryAttempt = useRef(0);
  const recoveryTimer = useRef(0);
  const coarse = useCoarsePointer();
  const [touchArmed, setTouchArmed] = useState(false);
  const instantMs = useAtlas((state) => state.instantMs);

  useEffect(() => () => window.clearTimeout(recoveryTimer.current), []);

  const remount = useCallback(() => {
    setLost(false);
    setCapability(probeWebGLCapability());
    setMount((value) => value + 1);
  }, []);

  const onLost = useCallback(() => {
    setLost(true);
    const delay = getWebGLRecoveryDelay(recoveryAttempt.current);
    if (delay === null) {
      setCapability({ status: "unsupported", reason: "context-lost" });
      return;
    }
    recoveryAttempt.current += 1;
    window.clearTimeout(recoveryTimer.current);
    // If the browser does not restore the context in time, start a new canvas.
    recoveryTimer.current = window.setTimeout(remount, delay + 2000);
  }, [remount]);

  const onRestored = useCallback(() => {
    window.clearTimeout(recoveryTimer.current);
    setLost(false);
  }, []);

  const retry = useCallback(() => {
    recoveryAttempt.current = 0;
    remount();
  }, [remount]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const turn = TURN_KEYS[event.key];
    if (turn) {
      event.preventDefault();
      apiRef.current?.turn(turn[0], turn[1]);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      apiRef.current?.zoom(0.85);
    } else if (event.key === "-") {
      event.preventDefault();
      apiRef.current?.zoom(1 / 0.85);
    }
  };

  const interactive = !coarse || touchArmed;

  return (
    <section aria-labelledby="scene-title" className={`relative min-w-0 ${className}`}>
      <h2 id="scene-title" className="sr-only">
        {t("sceneTitle")}
      </h2>
      <div
        ref={boxRef}
        role="group"
        aria-label={t("sceneLabel", { date: formatDate(instantMs) })}
        aria-describedby="scene-help"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative h-[280px] overflow-hidden bg-ground sm:h-[440px] lg:h-[560px]"
        data-testid="scene"
      >
        {capability.status === "supported" ? (
          <SceneErrorBoundary key={mount} fallback={<Fallback onRetry={retry} />} onError={() => setLost(false)}>
            <Canvas
              flat
              frameloop="demand"
              dpr={[1, 2]}
              gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
              camera={{ fov: 36, near: 0.05, far: 100, up: [0, 0, 1], position: [6, 0, 2.7] }}
              style={{ position: "absolute", inset: 0 }}
              fallback={<Fallback onRetry={retry} />}
            >
              <color attach="background" args={[UI_COLORS.ground]} />
              <ContextLossMonitor onLost={onLost} onRestored={onRestored} />
              <SkyScene overlayRef={overlayRef} apiRef={apiRef} interactive={interactive} />
            </Canvas>
          </SceneErrorBoundary>
        ) : capability.status === "checking" ? (
          <p className="text-muted p-6 text-small">{t("webglChecking")}</p>
        ) : (
          <Fallback onRetry={retry} />
        )}

        <canvas ref={overlayRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />

        <p className="text-muted pointer-events-none absolute right-3 bottom-2 text-caption">{t("notToScale")}</p>
        <p id="scene-help" className="sr-only">
          {t("sceneHelp")}
        </p>

        {capability.status === "supported" && canFullscreen ? (
          <button
            type="button"
            onClick={() => {
              if (fullscreen) void document.exitFullscreen();
              else void boxRef.current?.requestFullscreen();
            }}
            className="absolute top-2 right-2 z-10 min-h-11 rounded-control bg-dial/90 px-3 text-small hover:bg-raised sm:min-h-10"
          >
            {fullscreen ? t("fullscreenExit") : t("fullscreenEnter")}
          </button>
        ) : null}

        {lost ? (
          <p role="status" className="absolute inset-x-0 top-3 text-center text-small">
            {t("webglLost")}
          </p>
        ) : null}

        {capability.status === "supported" && coarse && !touchArmed ? (
          // Touch devices start locked, so a swipe over the scene scrolls the page.
          <button
            type="button"
            onClick={() => setTouchArmed(true)}
            aria-label={t("touchUnlockLabel")}
            className="absolute inset-0 flex touch-pan-y items-end justify-start bg-transparent pb-3 pl-3"
          >
            <span className="rounded-control bg-dial/90 px-4 py-2.5 text-small">{t("touchUnlock")}</span>
          </button>
        ) : null}
        {capability.status === "supported" && coarse && touchArmed ? (
          <button
            type="button"
            onClick={() => setTouchArmed(false)}
            aria-label={t("touchLockLabel")}
            className="absolute top-2 left-2 min-h-11 rounded-control bg-dial/90 px-4 text-small"
          >
            {t("touchLock")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
