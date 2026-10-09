/**
 * Fetches reference positions from NASA JPL Horizons once and stores them in
 * tests/fixtures/horizons-reference.json. The unit tests compare the engine
 * with this file. The app never calls Horizons.
 *
 *   node scripts/fetch-horizons-reference.ts
 *
 * Quantity 31: observer-centred ecliptic-of-date longitude and latitude of the
 * apparent position (light-time, light deflection and aberration applied),
 * seen from the Earth's centre (500@399). Horizons data is US government
 * work, credited in docs/DATA-SOURCES.md.
 */
import { writeFileSync } from "node:fs";

const API = "https://ssd.jpl.nasa.gov/api/horizons.api";
const OUTPUT = new URL("../tests/fixtures/horizons-reference.json", import.meta.url);

const BODIES = {
  sun: "10",
  moon: "301",
  mercury: "199",
  venus: "299",
  mars: "499",
  jupiter: "599",
  saturn: "699",
} as const;

/** Spread over 1900 to 2050, with some dates from the plan's test list. */
const INSTANTS_UTC = [
  "1900-01-01T00:00:00Z",
  "1918-11-11T00:00:00Z",
  "1945-08-15T00:00:00Z",
  "1969-07-20T20:17:00Z",
  "2000-01-01T12:00:00Z",
  "2019-12-26T05:18:00Z",
  "2020-12-21T18:20:00Z",
  "2024-04-08T18:17:00Z",
  "2035-06-01T00:00:00Z",
  "2050-12-31T00:00:00Z",
];

const julianDay = (iso: string) => Date.parse(iso) / 86_400_000 + 2_440_587.5;

interface Row {
  body: keyof typeof BODIES;
  utc: string;
  eclipticLongitudeDeg: number;
  eclipticLatitudeDeg: number;
}

async function fetchBody(body: keyof typeof BODIES): Promise<Row[]> {
  const params = new URLSearchParams({
    format: "json",
    COMMAND: `'${BODIES[body]}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'500@399'",
    TLIST: INSTANTS_UTC.map((iso) => `'${julianDay(iso).toFixed(9)}'`).join(" "),
    TLIST_TYPE: "'JD'",
    TIME_TYPE: "'UT'",
    QUANTITIES: "'31'",
    ANG_FORMAT: "'DEG'",
    CSV_FORMAT: "'YES'",
  });
  const response = await fetch(`${API}?${params.toString()}`);
  if (!response.ok) throw new Error(`Horizons answered ${response.status} for ${body}.`);
  const payload = (await response.json()) as { result?: string; error?: string };
  if (!payload.result) throw new Error(`Horizons error for ${body}: ${payload.error ?? "no result"}`);

  const block = payload.result.split("$$SOE")[1]?.split("$$EOE")[0];
  if (!block) throw new Error(`No ephemeris block for ${body}:\n${payload.result}`);
  const lines = block.trim().split("\n").filter((line) => line.trim().length > 0);
  if (lines.length !== INSTANTS_UTC.length) {
    throw new Error(`Expected ${INSTANTS_UTC.length} rows for ${body}, got ${lines.length}.`);
  }
  return lines.map((line, index) => {
    // CSV columns: date, solar-presence flag, lunar-presence flag, longitude, latitude.
    const columns = line.split(",").map((column) => column.trim());
    const longitude = Number(columns[3]);
    const latitude = Number(columns[4]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      throw new Error(`Cannot parse the Horizons row for ${body}: ${line}`);
    }
    return {
      body,
      utc: INSTANTS_UTC[index] as string,
      eclipticLongitudeDeg: longitude,
      eclipticLatitudeDeg: latitude,
    };
  });
}

const rows: Row[] = [];
for (const body of Object.keys(BODIES) as (keyof typeof BODIES)[]) {
  rows.push(...(await fetchBody(body)));
  console.log(`fetched ${body}`);
}

writeFileSync(
  OUTPUT,
  `${JSON.stringify(
    {
      source: "NASA JPL Horizons API (https://ssd.jpl.nasa.gov/horizons/)",
      fetched: new Date().toISOString().slice(0, 10),
      quantity: "31: apparent ecliptic-of-date longitude and latitude, geocentric (500@399)",
      rows,
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${rows.length} rows to ${OUTPUT.pathname}`);
