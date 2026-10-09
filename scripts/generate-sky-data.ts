/**
 * Generates the precomputed sky data in public/data.
 *
 *   node scripts/generate-sky-data.ts           write the files
 *   node scripts/generate-sky-data.ts --check   regenerate in memory and compare
 *
 * Files:
 * - sky-daily-1900-2050.bin and .json: sidereal longitude at 00:00 UTC each
 *   day for Sun, Mercury, Venus, Mars, Jupiter, Saturn and mean Rahu, as
 *   little-endian Uint16 (360/65536 degrees = about 20 arcseconds per step).
 * - sky-events-1900-2050.json: ingresses, stations, conjunctions, eclipses and
 *   Kala Sarpa windows, each instant refined to 1 minute.
 * - great-conjunctions-1000-2100.json: Jupiter-Saturn conjunctions.
 *
 * The check mode allows small differences (1 table step, 2 minutes, 0.002
 * degrees), because Math.sin can differ between V8 versions.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { formatHistoricalDate } from "../src/engine/calendar.ts";
import { findLunarEclipses, findSolarEclipses } from "../src/engine/eclipses.ts";
import { findGreatConjunctions } from "../src/engine/greatConjunctions.ts";
import {
  cachingSampler,
  findConjunctions,
  findIngresses,
  findKalaSarpaWindows,
  findStations,
  type Division,
} from "../src/engine/search.ts";
import { toAstroTime, toIsoMinute } from "../src/engine/time.ts";
import { RASIS, type GrahaId, type PhysicalGrahaId } from "../src/engine/zodiac.ts";

const CHECK = process.argv.includes("--check");
const DATA_DIR = new URL("../public/data/", import.meta.url);

const START = new Date("1900-01-01T00:00:00Z");
const END = new Date("2051-01-01T00:00:00Z");
const DAY_MS = 86_400_000;
const round3 = (value: number) => Math.round(value * 1000) / 1000;
/** One cache of 00:00 UTC positions serves every search and the daily table. */
const sampler = cachingSampler();
const SEARCH = { sampler };
const GENERATOR = {
  by: "scripts/generate-sky-data.ts",
  engine: "astronomy-engine 2.1.19",
  ayanamsa: "Lahiri (IAE anchor, IAU 1976 precession)",
  nodeModel: "mean",
};

// ---------------------------------------------------------------- daily table

const TABLE_SERIES = ["sun", "mercury", "venus", "mars", "jupiter", "saturn", "rahu"] as const;

function dailyTable(): { manifest: object; bytes: Uint8Array } {
  const days = Math.round((END.getTime() - START.getTime()) / DAY_MS);
  const values = new Uint16Array(days * TABLE_SERIES.length);
  TABLE_SERIES.forEach((id, series) => {
    for (let day = 0; day < days; day += 1) {
      const longitude = sampler(id, toAstroTime(new Date(START.getTime() + day * DAY_MS)));
      values[series * days + day] = Math.round((longitude * 65_536) / 360) % 65_536;
    }
  });
  // Uint16Array uses the platform byte order; write little-endian explicitly.
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setUint16(index * 2, value, true));
  return {
    manifest: {
      ...GENERATOR,
      file: "sky-daily-1900-2050.bin",
      start: START.toISOString(),
      stepDays: 1,
      days,
      series: TABLE_SERIES,
      layout: "series-major: value[series * days + day]",
      encoding: "uint16le, longitude = value * 360 / 65536 (sidereal degrees)",
    },
    bytes,
  };
}

// ----------------------------------------------------------------- sky events

const SIGN_INGRESS: readonly GrahaId[] = ["sun", "mercury", "venus", "mars", "jupiter", "saturn", "rahu"];
const NAKSHATRA_INGRESS: readonly GrahaId[] = ["jupiter", "saturn", "rahu"];
const STATIONS: readonly PhysicalGrahaId[] = ["mercury", "venus", "mars", "jupiter", "saturn"];
const PAIRS: readonly (readonly [GrahaId, GrahaId])[] = [
  ["jupiter", "saturn"],
  ["mars", "jupiter"],
  ["mars", "saturn"],
  ["mars", "rahu"],
  ["mars", "ketu"],
  ["jupiter", "rahu"],
  ["jupiter", "ketu"],
  ["saturn", "rahu"],
  ["saturn", "ketu"],
];

function skyEvents(): object {
  const ingresses = [
    ...SIGN_INGRESS.map((id) => ["sign", id] as const),
    ...NAKSHATRA_INGRESS.map((id) => ["nakshatra", id] as const),
  ]
    .flatMap(([division, id]) => findIngresses(id, division as Division, START, END, 1, SEARCH))
    .map((event) => ({
      graha: event.graha,
      division: event.division,
      time: toIsoMinute(event.time),
      from: event.from,
      to: event.to,
      retrograde: event.retrograde,
    }));

  const stations = STATIONS.flatMap((id) => findStations(id, START, END, 1, SEARCH)).map((event) => ({
    graha: event.graha,
    time: toIsoMinute(event.time),
    turns: event.turns,
    longitude: round3(event.siderealLongitudeDeg),
  }));

  const conjunctions = PAIRS.flatMap(([a, b]) => findConjunctions(a, b, START, END, 1, SEARCH)).map(
    (event) => ({
      a: event.a,
      b: event.b,
      time: toIsoMinute(event.time),
      longitude: round3(event.siderealLongitudeDeg),
    }),
  );

  const solarEclipses = findSolarEclipses(START, END).map((event) => ({
    time: toIsoMinute(event.peak),
    type: event.type,
    centralLine: event.centralLine,
    lat: round3(event.point.latitudeDeg),
    lon: round3(event.point.longitudeDeg),
    longitude: round3(event.siderealLongitudeDeg),
    nakshatra: event.nakshatraIndex,
  }));

  const lunarEclipses = findLunarEclipses(START, END).map((event) => ({
    time: toIsoMinute(event.peak),
    type: event.type,
    lat: round3(event.subLunarPoint.latitudeDeg),
    lon: round3(event.subLunarPoint.longitudeDeg),
    longitude: round3(event.siderealLongitudeDeg),
    nakshatra: event.nakshatraIndex,
  }));

  const kalaSarpa = findKalaSarpaWindows(START, END, 0.25, SEARCH).map((window) => ({
    start: toIsoMinute(window.start),
    end: toIsoMinute(window.end),
    side: window.side,
  }));

  const byTime = (a: { time: string }, b: { time: string }) => a.time.localeCompare(b.time);
  return {
    ...GENERATOR,
    range: [START.toISOString(), END.toISOString()],
    notes: {
      ingresses: "Sign index 0-11 (Aries to Pisces) or nakshatra index 0-26 (Ashwini to Revati).",
      longitude: "Sidereal degrees at the instant.",
      solarEclipses: "lat/lon: peak of the central line, or the sub-solar point when centralLine is false.",
      lunarEclipses: "lat/lon: sub-lunar point at peak.",
      kalaSarpa: "All 7 physical grahas (Moon included) on one side of the mean Rahu-Ketu axis.",
    },
    ingresses: ingresses.sort(byTime),
    stations: stations.sort(byTime),
    conjunctions: conjunctions.sort(byTime),
    solarEclipses,
    lunarEclipses,
    kalaSarpa,
  };
}

// --------------------------------------------------------- great conjunctions

function greatConjunctions(): object {
  const list = findGreatConjunctions(
    new Date("1000-01-01T00:00:00Z"),
    new Date("2101-01-01T00:00:00Z"),
  );
  return {
    ...GENERATOR,
    range: ["1000-01-01T00:00:00.000Z", "2101-01-01T00:00:00.000Z"],
    notes: {
      frame: "Geocentric ecliptic longitude. Lists in right ascension can differ by days.",
      approximate: "astronomy-engine documents 1-arcminute accuracy for the modern era only.",
      dateLabel: "Julian calendar before 1582-10-15, as history books give it.",
    },
    conjunctions: list.map((entry) => ({
      time: toIsoMinute(entry.time),
      dateLabel: formatHistoricalDate(entry.time.date),
      group: entry.group,
      siderealLongitude: round3(entry.siderealLongitudeDeg),
      siderealSign: entry.sidereal.name,
      siderealElement: entry.sidereal.element,
      tropicalLongitude: round3(entry.tropicalLongitudeDeg),
      tropicalSign: RASIS[entry.tropicalSignIndex],
      tropicalElement: entry.tropicalElement,
      approximate: entry.approximate,
    })),
  };
}

// ------------------------------------------------------------ compare / write

const MINUTE_MS = 60_000;

/** Compares 2 JSON values with the tolerances of the check mode. */
function differences(expected: unknown, actual: unknown, path = "$"): string[] {
  if (typeof expected === "number" && typeof actual === "number") {
    return Math.abs(expected - actual) <= 0.002 ? [] : [`${path}: ${expected} vs ${actual}`];
  }
  if (typeof expected === "string" && typeof actual === "string") {
    if (expected === actual) return [];
    const a = Date.parse(expected);
    const b = Date.parse(actual);
    const bothTimes = /^\d{4}-\d\d-\d\dT/.test(expected) && Number.isFinite(a) && Number.isFinite(b);
    return bothTimes && Math.abs(a - b) <= 2 * MINUTE_MS ? [] : [`${path}: ${expected} vs ${actual}`];
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) return [`${path}: length ${expected.length} vs ${actual.length}`];
    return expected.flatMap((item, index) => differences(item, actual[index], `${path}[${index}]`));
  }
  if (expected && actual && typeof expected === "object" && typeof actual === "object") {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    return [...keys].flatMap((key) =>
      differences(
        (expected as Record<string, unknown>)[key],
        (actual as Record<string, unknown>)[key],
        `${path}.${key}`,
      ),
    );
  }
  return expected === actual ? [] : [`${path}: ${String(expected)} vs ${String(actual)}`];
}

function tableDifferences(expected: Uint8Array, actual: Uint8Array): string[] {
  if (expected.length !== actual.length) return [`table length ${expected.length} vs ${actual.length}`];
  const a = new DataView(expected.buffer, expected.byteOffset, expected.byteLength);
  const b = new DataView(actual.buffer, actual.byteOffset, actual.byteLength);
  const problems: string[] = [];
  for (let offset = 0; offset < expected.length && problems.length < 10; offset += 2) {
    const step = (a.getUint16(offset, true) - b.getUint16(offset, true) + 65_536) % 65_536;
    if (step !== 0 && step !== 1 && step !== 65_535) problems.push(`table value ${offset / 2} differs by ${step} steps`);
  }
  return problems;
}

const json = (value: object) => `${JSON.stringify(value, null, 1)}\n`;
const started = Date.now();
// Events first: their searches fill the cache that the daily table reads.
const events = json(skyEvents());
const table = dailyTable();
const outputs: Record<string, string> = {
  "sky-daily-1900-2050.json": json(table.manifest),
  "sky-events-1900-2050.json": events,
  "great-conjunctions-1000-2100.json": json(greatConjunctions()),
};
console.log(`generated in ${((Date.now() - started) / 1000).toFixed(1)} s`);

if (CHECK) {
  const problems: string[] = [];
  const tablePath = new URL("sky-daily-1900-2050.bin", DATA_DIR);
  if (!existsSync(tablePath)) problems.push("missing sky-daily-1900-2050.bin");
  else problems.push(...tableDifferences(readFileSync(tablePath), table.bytes));
  for (const [name, content] of Object.entries(outputs)) {
    const path = new URL(name, DATA_DIR);
    if (!existsSync(path)) {
      problems.push(`missing ${name}`);
      continue;
    }
    problems.push(...differences(JSON.parse(readFileSync(path, "utf8")), JSON.parse(content), name).slice(0, 10));
  }
  if (problems.length > 0) {
    console.error(`Sky data is out of date. Run \`node scripts/generate-sky-data.ts\`.\n${problems.join("\n")}`);
    process.exit(1);
  }
  console.log("Sky data matches the engine within tolerance.");
} else {
  writeFileSync(new URL("sky-daily-1900-2050.bin", DATA_DIR), table.bytes);
  for (const [name, content] of Object.entries(outputs)) {
    writeFileSync(new URL(name, DATA_DIR), content);
  }
  console.log(`wrote public/data (${table.bytes.length} table bytes)`);
}
