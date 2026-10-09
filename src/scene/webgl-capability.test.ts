import { describe, expect, it } from "vitest";

import {
  classifyWebGLContext,
  probeWebGLCapability,
  type WebGLCanvasFactory,
  type WebGLContextProbe,
} from "./webgl-capability.ts";

function context(
  vendor: string,
  renderer: string,
  lost = false,
): WebGLContextProbe {
  return {
    VENDOR: 1,
    RENDERER: 2,
    getParameter(parameter) {
      return parameter === 1 ? vendor : renderer;
    },
    isContextLost: () => lost,
  };
}

describe("WebGL capability guard", () => {
  it("accepts a usable hardware or software renderer", () => {
    expect(
      classifyWebGLContext(
        context("Google Inc.", "ANGLE (Intel Iris Xe)"),
        "webgl2",
      ),
    ).toMatchObject({ status: "supported", api: "webgl2" });
    expect(
      classifyWebGLContext(
        context("Google Inc.", "ANGLE (SwiftShader)"),
        "webgl",
      ),
    ).toMatchObject({ status: "supported", api: "webgl" });
  });

  it("rejects the browser state reported as GL_VENDOR Disabled", () => {
    expect(
      classifyWebGLContext(context("Disabled", "Disabled"), "webgl2"),
    ).toEqual({ status: "unsupported", reason: "disabled" });
  });

  it("rejects a context that is already lost", () => {
    expect(
      classifyWebGLContext(context("Google Inc.", "ANGLE", true), "webgl2"),
    ).toEqual({ status: "unsupported", reason: "context-lost" });
  });

  it("tries WebGL 1 if WebGL 2 context creation fails", () => {
    const calls: string[] = [];
    const factory: WebGLCanvasFactory = () => ({
      getContext(api) {
        calls.push(api);
        return api === "webgl" ? context("Mozilla", "Mesa") : null;
      },
    });

    expect(probeWebGLCapability(factory)).toMatchObject({
      status: "supported",
      api: "webgl",
    });
    expect(calls).toEqual(["webgl2", "webgl"]);
  });

  it("returns a stable failure instead of throwing when contexts fail", () => {
    const factory: WebGLCanvasFactory = () => ({
      getContext() {
        throw new Error("GPU process unavailable");
      },
    });

    expect(probeWebGLCapability(factory)).toEqual({
      status: "unsupported",
      reason: "context-unavailable",
    });
  });
});
