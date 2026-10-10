import { test, type Page } from "@playwright/test";

/**
 * Screenshots for design review, one per viewport. They are not pass or fail
 * checks: software WebGL in CI paints differently from a real GPU. The date is
 * fixed (the great conjunction of 2020), so screenshots can be compared.
 */

type DebugWindow = Window & {
  __MEDINI_DEBUG__?: {
    frames: number;
    mapsWidth: number;
    projectGeo(latitudeDeg: number, longitudeDeg: number): { x: number; y: number; facing: boolean };
  };
};

/** Waits for the scene and its full-size Earth maps. */
async function waitForScene(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const debug = (window as DebugWindow).__MEDINI_DEBUG__;
      return Boolean(debug && debug.frames > 0 && debug.mapsWidth >= 2048);
    },
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(300);
}

test("capture the main screen", async ({ page }, testInfo) => {
  await page.goto("/#d=2020-12-21&from=2014-12-21&to=2026-12-21");
  await waitForScene(page);
  await page.screenshot({
    path: `e2e-artifacts/screens/${testInfo.project.name}-main.png`,
    fullPage: true,
  });
});

test("capture the classical Koorma mode, with the tooltip of a lit region", async ({ page, isMobile }, testInfo) => {
  await page.goto("/#d=2020-12-21&from=2014-12-21&to=2026-12-21&koorma=classical");
  await waitForScene(page);
  const scene = page.getByTestId("scene");
  await scene.scrollIntoViewIfNeeded();
  if (!isMobile) {
    // Karachi lies in the west wedge, lit by the solar eclipse of 14 December 2020.
    const point = await page.evaluate(() => (window as DebugWindow).__MEDINI_DEBUG__?.projectGeo(24.86, 67.01));
    const box = await scene.boundingBox();
    if (point && box) await page.mouse.move(box.x + point.x, box.y + point.y);
    await page.waitForTimeout(200);
  }
  await scene.screenshot({ path: `e2e-artifacts/screens/review-${testInfo.project.name}-classical.png` });
});
