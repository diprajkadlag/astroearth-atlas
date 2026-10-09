import { expect, test, type Page } from "@playwright/test";

import { signedAngularDelta } from "../src/engine/angles.ts";
import { siderealLongitude, subPlanetPoint } from "../src/engine/positions.ts";

/**
 * Milestone M3: one date drives the scene, the ruler, the lanes and the
 * table. Scene checks read positions from the debug hook on window (see
 * src/scene/SkyScene.tsx), never from pixels: software WebGL in CI paints
 * differently from a real GPU.
 */

interface DebugHook {
  frames: number;
  instantMs: number;
  earthInstantMs: number;
  cameraUp: [number, number, number];
  subSolarFromScene(): { latitudeDeg: number; longitudeDeg: number };
  markerLongitude(id: string): number;
}

type DebugWindow = Window & { __MEDINI_DEBUG__?: DebugHook };

async function sceneReady(page: Page, instantMs?: number): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const debug = (window as DebugWindow).__MEDINI_DEBUG__;
      if (!debug || debug.frames < 1) return false;
      return expected === undefined || debug.instantMs === expected;
    },
    instantMs,
    { timeout: 30_000 },
  );
}

async function subSolar(page: Page) {
  return page.evaluate(() => (window as DebugWindow).__MEDINI_DEBUG__!.subSolarFromScene());
}

function expectNear(actual: number, expected: number, tolerance: number, label: string) {
  expect(Math.abs(actual - expected), `${label}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tolerance);
}

test.describe("scene orientation", () => {
  test("puts the Earth under the Sun as the engine does, at 00:00 UTC", async ({ page }) => {
    const instant = Date.UTC(2020, 11, 21);
    await page.goto("/#d=2020-12-21&from=2014-12-21&to=2026-12-21");
    await sceneReady(page, instant);

    const up = await page.evaluate(() => (window as DebugWindow).__MEDINI_DEBUG__!.cameraUp);
    expect(up).toEqual([0, 0, 1]);

    const fromScene = await subSolar(page);
    const fromEngine = subPlanetPoint("sun", new Date(instant));
    expectNear(fromScene.latitudeDeg, fromEngine.latitudeDeg, 0.1, "latitude");
    expectNear(Math.abs(signedAngularDelta(fromScene.longitudeDeg, fromEngine.longitudeDeg)), 0, 0.1, "longitude");
  });

  test("turns the Earth to the true time of day when the step is under 1 day", async ({ page }) => {
    // A 4-day span gives hour steps, so the Earth shows 18:26 UTC (DESIGN.md, Earth motion).
    const instant = Date.UTC(2020, 11, 21, 18, 26);
    await page.goto("/#d=2020-12-21T18:26Z&from=2020-12-19&to=2020-12-23");
    await sceneReady(page, instant);

    const earthInstant = await page.evaluate(() => (window as DebugWindow).__MEDINI_DEBUG__!.earthInstantMs);
    expect(earthInstant).toBe(instant);
    const fromScene = await subSolar(page);
    const fromEngine = subPlanetPoint("sun", new Date(instant));
    expectNear(fromScene.latitudeDeg, fromEngine.latitudeDeg, 0.1, "latitude");
    expectNear(Math.abs(signedAngularDelta(fromScene.longitudeDeg, fromEngine.longitudeDeg)), 0, 0.1, "longitude");
  });

  test("places each graha marker at its sidereal longitude", async ({ page }) => {
    const instant = Date.UTC(2020, 11, 21);
    await page.goto("/#d=2020-12-21&from=2014-12-21&to=2026-12-21");
    await sceneReady(page, instant);
    for (const id of ["sun", "moon", "jupiter", "saturn", "rahu", "ketu"] as const) {
      const marker = await page.evaluate((graha) => (window as DebugWindow).__MEDINI_DEBUG__!.markerLongitude(graha), id);
      const engine = siderealLongitude(id, new Date(instant));
      expectNear(Math.abs(signedAngularDelta(marker, engine)), 0, 0.01, id);
    }
  });
});

test.describe("one date drives everything", () => {
  test("the ruler moves the scene, the lanes, the header and the table together", async ({ page }) => {
    await page.goto("/#d=2020-12-21&from=2018-12-21&to=2022-12-21");
    await sceneReady(page, Date.UTC(2020, 11, 21));

    const ruler = page.getByRole("slider", { name: "Date" });
    await expect(ruler).toHaveAttribute("aria-valuetext", "21 December 2020");
    const cursor = page.getByTestId("lanes-cursor");
    const cursorBefore = await cursor.evaluate((element) => element.style.transform);
    const moonBefore = await page.evaluate(() => (window as DebugWindow).__MEDINI_DEBUG__!.markerLongitude("moon"));

    // A 4-year span steps by 1 day.
    await ruler.focus();
    await page.keyboard.press("ArrowRight");
    await expect(ruler).toHaveAttribute("aria-valuetext", "22 December 2020");
    await sceneReady(page, Date.UTC(2020, 11, 22));

    await expect(page.getByTestId("current-date")).toHaveText("22 December 2020");
    await expect.poll(() => cursor.evaluate((element) => element.style.transform)).not.toBe(cursorBefore);
    const moonAfter = await page.evaluate(() => (window as DebugWindow).__MEDINI_DEBUG__!.markerLongitude("moon"));
    // The Moon moves about 13 degrees a day.
    expect(Math.abs(signedAngularDelta(moonBefore, moonAfter))).toBeGreaterThan(10);
    await expect(page.locator('[data-graha="moon"]')).toContainText(/°/);
  });

  test("the ruler follows the WAI-ARIA slider pattern", async ({ page }) => {
    await page.goto("/#d=2020-12-21&from=2018-12-21&to=2022-12-21");
    const ruler = page.getByRole("slider", { name: "Date" });
    await ruler.focus();
    await page.keyboard.press("Home");
    await expect(ruler).toHaveAttribute("aria-valuetext", "1 January 1900");
    await expect(ruler).toHaveAttribute("aria-valuenow", "0");
    await page.keyboard.press("End");
    await expect(ruler).toHaveAttribute("aria-valuetext", "31 December 2050");
    await page.keyboard.press("PageDown");
    await expect(ruler).toHaveAttribute("aria-valuetext", "21 December 2050");
  });

  test("a click on the lanes sets the date", async ({ page }) => {
    await page.goto("/#d=2020-12-21&from=2018-12-21&to=2022-12-21");
    const lanes = page.getByRole("img", { name: /Sidereal longitude of/ });
    // Mouse clicks use viewport coordinates, so the lanes must be on screen.
    await lanes.scrollIntoViewIfNeeded();
    const box = await lanes.boundingBox();
    if (!box) throw new Error("The lanes have no box.");
    await page.mouse.click(box.x + box.width - 30, box.y + box.height / 2);
    const text = await page.getByRole("slider", { name: "Date" }).getAttribute("aria-valuetext");
    expect(text).toMatch(/2022$/);
  });

  test("the share link follows the date", async ({ page }) => {
    await page.goto("/#d=1947-08-15");
    await expect(page.getByTestId("current-date")).toHaveText("15 August 1947");
    const ruler = page.getByRole("slider", { name: "Date" });
    await ruler.focus();
    await page.keyboard.press("End");
    await expect.poll(() => page.evaluate(() => window.location.hash)).toContain("d=2050-12-31");
  });
});

test("shows the fallback text when WebGL is not available", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === "webgl" || type === "webgl2") return null;
      return (original as (this: HTMLCanvasElement, type: string, ...args: unknown[]) => RenderingContext | null).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/#d=2020-12-21");
  await expect(page.getByText("The 3D view is not available")).toBeVisible();
  // The sky table still lists all 9 grahas.
  await expect(page.locator("[data-graha]")).toHaveCount(9);
});
