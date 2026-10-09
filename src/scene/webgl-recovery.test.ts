import { describe, expect, it } from "vitest";

import {
  getWebGLRecoveryDelay,
  WEBGL_RECOVERY_DELAYS_MS,
} from "./webgl-recovery.ts";

describe("WebGL automatic recovery budget", () => {
  it("uses a short bounded backoff", () => {
    expect(
      WEBGL_RECOVERY_DELAYS_MS.map((_, attempt) =>
        getWebGLRecoveryDelay(attempt),
      ),
    ).toEqual([...WEBGL_RECOVERY_DELAYS_MS]);
    expect(getWebGLRecoveryDelay(WEBGL_RECOVERY_DELAYS_MS.length)).toBeNull();
  });

  it("rejects invalid attempt indexes", () => {
    expect(getWebGLRecoveryDelay(-1)).toBeNull();
    expect(getWebGLRecoveryDelay(0.5)).toBeNull();
  });
});
