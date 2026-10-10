import { describe, expect, it } from "vitest";

import { DEG } from "./angles.ts";
import {
  CENTRE_RADIUS_DEG,
  KOORMA_CENTRE,
  KOORMA_REGIONS,
  angularDistanceDeg,
  greatCircleBearingDeg,
  koormaGlow,
  koormaRegionAt,
  litNakshatras,
  regionOfNakshatra,
  rhumbBearingDeg,
  type GlowInput,
  type KoormaRegionId,
} from "./koorma.ts";
import type { GeoPoint } from "./positions.ts";

const place = (latitudeDeg: number, longitudeDeg: number): GeoPoint => ({ latitudeDeg, longitudeDeg });

/** The point at a great-circle distance and initial bearing from Mathura. */
function fromCentre(bearingDeg: number, distanceDeg: number): GeoPoint {
  const lat1 = KOORMA_CENTRE.latitudeDeg * DEG;
  const lon1 = KOORMA_CENTRE.longitudeDeg * DEG;
  const d = distanceDeg * DEG;
  const b = bearingDeg * DEG;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lon2 = lon1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return place(lat2 / DEG, lon2 / DEG);
}

describe("Koorma regions (Brihat Samhita 14)", () => {
  it("give each of the 27 nakshatras to exactly one division, from Krittika", () => {
    const all = KOORMA_REGIONS.flatMap((region) => [...region.nakshatras]).sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: 27 }, (_, index) => index));
    expect(KOORMA_REGIONS[0]?.id).toBe("centre");
    expect(KOORMA_REGIONS[0]?.nakshatras).toEqual([2, 3, 4]);
    expect(regionOfNakshatra(26).id).toBe("north-east");
    expect(regionOfNakshatra(0).id).toBe("north-east");
    expect(regionOfNakshatra(17).id).toBe("west");
  });

  it("go round from the east through the south-east and the south, as stanza 1 says", () => {
    expect(KOORMA_REGIONS.map((region) => region.bearingDeg)).toEqual([null, 90, 135, 180, 225, 270, 315, 0, 45]);
  });
});

describe("Koorma geometry", () => {
  it("measures distances and bearings", () => {
    expect(angularDistanceDeg(KOORMA_CENTRE, place(28.61, 77.21))).toBeCloseTo(1.2, 1);
    expect(greatCircleBearingDeg(place(0, 0), place(10, 0))).toBeCloseTo(0, 9);
    expect(greatCircleBearingDeg(place(0, 0), place(0, 10))).toBeCloseTo(90, 9);
    // Along a parallel the rhumb line runs due east, while the great circle starts north of east.
    expect(rhumbBearingDeg(KOORMA_CENTRE, place(27.49, 117.67))).toBeCloseTo(90, 9);
    // atan2(sin 40°, sin 27.49° × (1 − cos 40°)) = 80.46°.
    expect(greatCircleBearingDeg(KOORMA_CENTRE, place(27.49, 117.67))).toBeCloseTo(80.46, 2);
  });

  it("reads Alaska to the east of the centre in global mode, not to the north", () => {
    const anchorage = place(61.22, -149.9);
    expect(greatCircleBearingDeg(KOORMA_CENTRE, anchorage)).toBeLessThan(25);
    expect(rhumbBearingDeg(KOORMA_CENTRE, anchorage)).toBeGreaterThan(60);
  });

  it("puts the centre circle of 5.5 degrees around Mathura in both modes", () => {
    for (const mode of ["global", "classical"] as const) {
      expect(koormaRegionAt(KOORMA_CENTRE, mode).region).toBe("centre");
      expect(koormaRegionAt(place(28.61, 77.21), mode).region).toBe("centre");
      expect(koormaRegionAt(fromCentre(10, CENTRE_RADIUS_DEG - 0.1), mode).region).toBe("centre");
      expect(koormaRegionAt(fromCentre(10, CENTRE_RADIUS_DEG + 0.1), mode).region).toBe("north");
    }
  });

  it("sorts places around the centre into 8 wedges of 45 degrees", () => {
    const wedges: [number, KoormaRegionId][] = [
      [0, "north"],
      [45, "north-east"],
      [90, "east"],
      [135, "south-east"],
      [180, "south"],
      [225, "south-west"],
      [270, "west"],
      [315, "north-west"],
      [20, "north"],
      [25, "north-east"],
    ];
    for (const [bearing, region] of wedges) {
      expect(koormaRegionAt(fromCentre(bearing, 12), "classical").region, `bearing ${bearing}`).toBe(region);
    }
  });

  it("classical mode: cities of the subcontinent, by great-circle bearing", () => {
    const cities: [string, GeoPoint, KoormaRegionId][] = [
      ["Patna", place(25.59, 85.14), "east"],
      ["Lhasa", place(29.65, 91.12), "east"],
      ["Bhubaneswar", place(20.3, 85.82), "south-east"],
      ["Chennai", place(13.08, 80.27), "south"],
      ["Colombo", place(6.93, 79.85), "south"],
      ["Rajkot", place(22.3, 70.8), "south-west"],
      ["Karachi", place(24.86, 67.01), "west"],
      ["Kabul", place(34.53, 69.17), "north-west"],
    ];
    for (const [name, point, region] of cities) {
      expect(koormaRegionAt(point, "classical").region, name).toBe(region);
    }
  });

  it("classical mode ends 25 degrees from the centre", () => {
    expect(koormaRegionAt(fromCentre(90, 24.5), "classical").region).toBe("east");
    expect(koormaRegionAt(fromCentre(90, 25.5), "classical").region).toBeNull();
    expect(koormaRegionAt(place(35.68, 139.69), "classical").region).toBeNull();
  });

  it("global mode: the half of the Earth around the centre, by rhumb-line bearing", () => {
    const cities: [string, GeoPoint, KoormaRegionId | null][] = [
      ["Tokyo", place(35.68, 139.69), "east"],
      ["Jakarta", place(-6.2, 106.85), "south-east"],
      ["Nairobi", place(-1.29, 36.82), "south-west"],
      ["Cape Town", place(-33.92, 18.42), "south-west"],
      ["Cairo", place(30.04, 31.24), "west"],
      ["Moscow", place(55.75, 37.62), "north-west"],
      ["New York", place(40.71, -74.01), null],
      ["Sydney", place(-33.87, 151.21), null],
    ];
    for (const [name, point, region] of cities) {
      expect(koormaRegionAt(point, "global").region, name).toBe(region);
    }
  });
});

/** Longitude in the middle of a nakshatra. */
const inNakshatra = (index: number) => (index + 0.5) * (360 / 27);

function input(partial: Partial<GlowInput>): GlowInput {
  return {
    instantMs: Date.UTC(2020, 0, 15),
    grahas: [
      { id: "sun", siderealLongitudeDeg: inNakshatra(18), retrograde: false },
      { id: "jupiter", siderealLongitudeDeg: inNakshatra(19), retrograde: false },
      { id: "saturn", siderealLongitudeDeg: inNakshatra(26), retrograde: false },
      { id: "mars", siderealLongitudeDeg: inNakshatra(7), retrograde: false },
      { id: "rahu", siderealLongitudeDeg: inNakshatra(1), retrograde: true },
      { id: "ketu", siderealLongitudeDeg: inNakshatra(15), retrograde: true },
    ],
    eclipses: [],
    stations: [],
    ...partial,
  };
}

const strengthOf = (glow: ReturnType<typeof koormaGlow>, id: KoormaRegionId) =>
  glow.find((item) => item.region.id === id)?.strength;

describe("Koorma glow (DESIGN.md: 3 strengths)", () => {
  it("lights the divisions of Saturn, Mars, Rahu and Ketu softly", () => {
    const glow = koormaGlow(input({}));
    expect(strengthOf(glow, "north-east")).toBe(1);
    expect(glow.find((item) => item.region.id === "north-east")?.reasons.map((reason) => reason.kind)).toEqual(["transit", "transit"]);
    expect(strengthOf(glow, "east")).toBe(1);
    expect(strengthOf(glow, "south-west")).toBe(1);
    // The Sun and Jupiter in the west give no glow.
    expect(strengthOf(glow, "west")).toBe(0);
    expect(strengthOf(glow, "centre")).toBe(0);
  });

  it("lights a retrograde malefic at the middle strength, with one reason", () => {
    const base = input({});
    const glow = koormaGlow({
      ...base,
      grahas: base.grahas.map((graha) => (graha.id === "saturn" ? { ...graha, retrograde: true } : graha)),
    });
    const northEast = glow.find((item) => item.region.id === "north-east");
    expect(northEast?.strength).toBe(2);
    expect(northEast?.reasons.map((reason) => `${reason.kind}`)).toEqual(["retrograde", "transit"]);
    expect(northEast?.reasons.filter((reason) => "graha" in reason && reason.graha === "saturn")).toHaveLength(1);
  });

  it("lights a station within 3 days, of any of the 5 star grahas", () => {
    const at = Date.UTC(2020, 0, 15);
    const station = (days: number) => ({ graha: "jupiter" as const, timeMs: at - days * 86_400_000, turns: "retrograde" as const, longitudeDeg: inNakshatra(6) });
    expect(strengthOf(koormaGlow(input({ stations: [station(2.5)] })), "east")).toBe(2);
    expect(strengthOf(koormaGlow(input({ stations: [station(3.5)] })), "east")).toBe(1);
  });

  it("lights an eclipse within 7 days most strongly, but not a penumbral lunar eclipse", () => {
    const at = Date.UTC(2020, 0, 15);
    const eclipse = (kind: "solar" | "lunar", type: string, days: number) => ({ kind, type, timeMs: at + days * 86_400_000, nakshatra: 17 });
    expect(strengthOf(koormaGlow(input({ eclipses: [eclipse("solar", "total", 6.5)] })), "west")).toBe(3);
    expect(strengthOf(koormaGlow(input({ eclipses: [eclipse("lunar", "partial", -6.5)] })), "west")).toBe(3);
    expect(strengthOf(koormaGlow(input({ eclipses: [eclipse("solar", "annular", 7.5)] })), "west")).toBe(0);
    expect(strengthOf(koormaGlow(input({ eclipses: [eclipse("lunar", "penumbral", 1)] })), "west")).toBe(0);
  });

  it("gives the strongest glow of each lit nakshatra for the ring", () => {
    const at = Date.UTC(2020, 0, 15);
    const lit = litNakshatras(koormaGlow(input({ eclipses: [{ kind: "solar", type: "total", timeMs: at, nakshatra: 1 }] })));
    expect(lit.get(1)).toBe(3);
    expect(lit.get(26)).toBe(1);
    expect(lit.has(18)).toBe(false);
  });
});
