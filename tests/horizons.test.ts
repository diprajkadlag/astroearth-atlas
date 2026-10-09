import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { signedAngularDelta } from "../src/engine/angles.ts";
import { eclipticPosition } from "../src/engine/positions.ts";
import type { PhysicalGrahaId } from "../src/engine/zodiac.ts";

interface ReferenceRow {
  body: PhysicalGrahaId;
  utc: string;
  eclipticLongitudeDeg: number;
  eclipticLatitudeDeg: number;
}

const reference = JSON.parse(
  readFileSync(new URL("./fixtures/horizons-reference.json", import.meta.url), "utf8"),
) as { rows: ReferenceRow[] };

/** 30 arcseconds: half of the 1-arcminute target. The worst case on 2026-10-09 was 13 arcseconds (Moon, 2050). */
const TOLERANCE_DEG = 30 / 3600;

describe("engine against NASA JPL Horizons", () => {
  it("has 70 reference rows (7 bodies at 10 instants, 1900 to 2050)", () => {
    expect(reference.rows).toHaveLength(70);
  });

  it.each(reference.rows.map((row) => [row.body, row.utc, row] as const))(
    "%s at %s agrees within 30 arcseconds",
    (_body, _utc, row) => {
      const position = eclipticPosition(row.body, new Date(row.utc));
      expect(Math.abs(signedAngularDelta(row.eclipticLongitudeDeg, position.tropicalLongitudeDeg))).toBeLessThan(TOLERANCE_DEG);
      expect(Math.abs(row.eclipticLatitudeDeg - position.eclipticLatitudeDeg)).toBeLessThan(TOLERANCE_DEG);
    },
  );
});
