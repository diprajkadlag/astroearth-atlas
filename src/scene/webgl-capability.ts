// Ported from VedicAstrologer (same author, MIT), components/3d/webgl-capability.ts.
export type WebGLApi = "webgl2" | "webgl";

export type WebGLFailureReason =
  | "api-unavailable"
  | "context-unavailable"
  | "disabled"
  | "context-lost"
  | "runtime-error";

export type WebGLCapability =
  | { status: "checking" }
  | {
      status: "supported";
      api: WebGLApi;
      vendor?: string;
      renderer?: string;
    }
  | {
      status: "unsupported";
      reason: WebGLFailureReason;
    };

export interface WebGLContextProbe {
  VENDOR?: number;
  RENDERER?: number;
  getParameter?(parameter: number): unknown;
  isContextLost?(): boolean;
}

export interface WebGLCanvasProbe {
  getContext(
    contextId: WebGLApi,
    attributes?: WebGLContextAttributes,
  ): unknown;
}

export type WebGLCanvasFactory = () => WebGLCanvasProbe;

const DISABLED_RENDERER_PATTERN =
  /\b(disabled|blocked|unavailable|not available)\b/i;

function parameterText(
  context: WebGLContextProbe,
  parameter: number | undefined,
): string | undefined {
  if (parameter === undefined || typeof context.getParameter !== "function") {
    return undefined;
  }
  try {
    const value = context.getParameter(parameter);
    return typeof value === "string" && value.trim()
      ? value.trim()
      : undefined;
  } catch {
    // Vendor metadata is optional. A context that can render should not be
    // rejected merely because the browser withholds identifying information.
    return undefined;
  }
}

export function classifyWebGLContext(
  context: WebGLContextProbe,
  api: WebGLApi,
): WebGLCapability {
  if (context.isContextLost?.()) {
    return { status: "unsupported", reason: "context-lost" };
  }

  const vendor = parameterText(context, context.VENDOR);
  const renderer = parameterText(context, context.RENDERER);
  if (
    (vendor && DISABLED_RENDERER_PATTERN.test(vendor)) ||
    (renderer && DISABLED_RENDERER_PATTERN.test(renderer))
  ) {
    return { status: "unsupported", reason: "disabled" };
  }

  return {
    status: "supported",
    api,
    ...(vendor ? { vendor } : {}),
    ...(renderer ? { renderer } : {}),
  };
}

/**
 * Performs a disposable context check before React Three Fiber is mounted.
 * This prevents renderer-construction exceptions from reaching the error
 * overlay when a browser advertises canvas support but disables
 * its WebGL/GPU path.
 */
export function probeWebGLCapability(
  createCanvas?: WebGLCanvasFactory,
): WebGLCapability {
  let factory = createCanvas;
  if (!factory) {
    if (
      typeof document === "undefined" ||
      (typeof WebGLRenderingContext === "undefined" &&
        typeof WebGL2RenderingContext === "undefined")
    ) {
      return { status: "unsupported", reason: "api-unavailable" };
    }
    factory = () => document.createElement("canvas");
  }

  for (const api of ["webgl2", "webgl"] as const) {
    try {
      const canvas = factory();
      const context = canvas.getContext(api, {
        alpha: false,
        antialias: false,
        depth: true,
        failIfMajorPerformanceCaveat: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
        stencil: false,
      }) as WebGLContextProbe | null;
      if (!context) continue;

      const result = classifyWebGLContext(context, api);
      if (
        result.status === "supported" ||
        (result.status === "unsupported" && result.reason === "disabled")
      ) {
        return result;
      }
    } catch {
      // Try the WebGL 1 fallback before declaring the browser unsupported.
    }
  }

  return { status: "unsupported", reason: "context-unavailable" };
}
