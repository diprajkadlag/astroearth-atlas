import { describe, expect, it } from "vitest";

import { KOORMA_REGIONS, koormaRegion } from "../engine/koorma.ts";
import { KOORMA_UNIFORM_ORDER } from "./earthMaterial.ts";

describe("Koorma strength uniform", () => {
  it("lists the centre, then the wedge that the shader centres on bearing (i - 1) × 45°", () => {
    expect(KOORMA_UNIFORM_ORDER).toHaveLength(9);
    expect(new Set(KOORMA_UNIFORM_ORDER).size).toBe(KOORMA_REGIONS.length);
    expect(KOORMA_UNIFORM_ORDER[0]).toBe("centre");
    for (let index = 1; index < KOORMA_UNIFORM_ORDER.length; index += 1) {
      const id = KOORMA_UNIFORM_ORDER[index];
      if (!id) throw new Error(`No region at index ${index}`);
      expect(koormaRegion(id).bearingDeg, id).toBe((index - 1) * 45);
    }
  });
});
