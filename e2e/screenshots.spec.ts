import { test } from "@playwright/test";

/**
 * Screenshots for design review, one per viewport. They are not pass or fail
 * checks: software WebGL in CI paints differently from a real GPU.
 */
test("capture the main screen", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: `e2e-artifacts/screens/${testInfo.project.name}-main.png`,
    fullPage: true,
  });
});
