import { describe, expect, it } from "vitest";

import type { GrahaPosition } from "./positions.ts";
import { aspects, combustion, conjunctions, grahaYuddha, kalaSarpa } from "./rules.ts";
import { GRAHA_IDS, zodiacPlacement, type GrahaId } from "./zodiac.ts";

/** A synthetic sky: longitudes are sidereal degrees; retrograde grahas are listed. */
function sky(longitudes: Record<GrahaId, number>, retrograde: GrahaId[] = []): GrahaPosition[] {
  return GRAHA_IDS.map((id) => ({
    id,
    tropicalLongitudeDeg: longitudes[id],
    eclipticLatitudeDeg: 0,
    distanceAu: null,
    speedDegPerDay: retrograde.includes(id) ? -0.1 : 0.1,
    motion: retrograde.includes(id) ? "retrograde" : "direct",
    retrograde: retrograde.includes(id),
    ...zodiacPlacement(longitudes[id]),
  }));
}

const BASE: Record<GrahaId, number> = {
  sun: 100, moon: 200, mercury: 110, venus: 130, mars: 250,
  jupiter: 320, saturn: 5, rahu: 40, ketu: 220,
};

describe("graha drishti", () => {
  it("gives Saturn in Aries its 3rd, 7th and 10th sign aspects", () => {
    const fromSaturn = aspects(sky({ ...BASE, saturn: 5, moon: 65, venus: 185, mars: 275 }))
      .filter((aspect) => aspect.from === "saturn")
      .map((aspect) => [aspect.to, aspect.house]);
    expect(fromSaturn).toEqual(
      expect.arrayContaining([["moon", 3], ["venus", 7], ["mars", 10]]),
    );
  });

  it("casts no aspects from Rahu or Ketu", () => {
    const fromNodes = aspects(sky(BASE)).filter((aspect) => aspect.from === "rahu" || aspect.from === "ketu");
    expect(fromNodes).toEqual([]);
  });
});

describe("conjunctions, planetary war and combustion", () => {
  it("never reports Rahu and Ketu as a conjunction", () => {
    const pairs = conjunctions(sky(BASE), 180).map((pair) => `${pair.a}-${pair.b}`);
    expect(pairs).not.toContain("rahu-ketu");
  });

  it("finds planetary war within 1 degree only among the 5 star grahas", () => {
    const war = grahaYuddha(sky({ ...BASE, mars: 250, jupiter: 250.6, moon: 250.3 }));
    expect(war.map((pair) => `${pair.a}-${pair.b}`)).toEqual(["mars-jupiter"]);
  });

  it("uses the smaller combustion orb for retrograde Mercury", () => {
    const direct = combustion(sky({ ...BASE, mercury: 113 }));
    const retro = combustion(sky({ ...BASE, mercury: 113 }, ["mercury"]));
    expect(direct.find((entry) => entry.id === "mercury")?.orbDeg).toBe(14);
    expect(retro.find((entry) => entry.id === "mercury")).toBeUndefined();
  });
});

describe("Kala Sarpa", () => {
  it("detects all 7 grahas on one side of the nodal axis", () => {
    const hemmed = sky({ ...BASE, rahu: 0, ketu: 180, sun: 10, moon: 20, mercury: 30, venus: 40, mars: 50, jupiter: 60, saturn: 170 });
    expect(kalaSarpa(hemmed)).toEqual({ active: true, side: "rahu-to-ketu" });
  });

  it("is broken by one graha on the other side", () => {
    const broken = sky({ ...BASE, rahu: 0, ketu: 180, sun: 10, moon: 200, mercury: 30, venus: 40, mars: 50, jupiter: 60, saturn: 170 });
    expect(kalaSarpa(broken)).toEqual({ active: false, side: null });
  });
});
