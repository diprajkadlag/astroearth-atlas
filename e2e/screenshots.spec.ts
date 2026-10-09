import { test } from "@playwright/test";

/**
 * Screenshots for design review, one per viewport. They are not pass or fail
 * checks: software WebGL in CI paints differently from a real GPU. The date is
 * fixed (the great conjunction of 2020), so screenshots can be compared.
 */
test("capture the main screen", async ({ page }, testInfo) => {
  await page.goto("/#d=2020-12-21&from=2014-12-21&to=2026-12-21");
  // Wait for the scene and its full-size Earth maps.
  await page.waitForFunction(
    () => {
      const debug = (window as Window & { __MEDINI_DEBUG__?: { frames: number; mapsWidth: number } }).__MEDINI_DEBUG__;
      return Boolean(debug && debug.frames > 0 && debug.mapsWidth >= 2048);
    },
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(300);
  await page.screenshot({
    path: `e2e-artifacts/screens/${testInfo.project.name}-main.png`,
    fullPage: true,
  });
});
