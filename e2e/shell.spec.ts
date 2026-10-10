import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow, recordForeignRequests } from "./helpers.ts";

test.describe("app shell", () => {
  test("loads with its name and disclaimer, and makes no foreign requests", async ({
    page,
    baseURL,
  }) => {
    const appOrigin = new URL(baseURL ?? "http://127.0.0.1").origin;
    const foreign = recordForeignRequests(page, appOrigin);

    await page.goto("/");
    await expect(page).toHaveTitle("AstroEarth Atlas");
    await expect(
      page.getByRole("heading", { level: 1, name: "AstroEarth Atlas" }),
    ).toBeVisible();
    await expect(page.getByText("It does not predict events")).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(foreign, `requests to other origins:\n${foreign.join("\n")}`).toEqual([]);
  });

  test("ships a same-origin Content-Security-Policy", async ({ page }) => {
    await page.goto("/");
    const policy = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content");

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self'");
    expect(policy).not.toMatch(/https?:/);
  });

  test("fits the viewport without horizontal scrolling", async ({ page }) => {
    await page.goto("/");
    await expectNoHorizontalOverflow(page);
  });

  test("has no serious or critical accessibility violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations
      .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
      .map((violation) => `${violation.id}: ${violation.help}`);

    expect(blocking).toEqual([]);
  });
});

test("has no serious accessibility violations in the Cycles view with a card open", async ({ page }) => {
  await page.goto("/#d=2020-12-14T16:13Z&view=cycles&event=solar-eclipse-2020-12-14");
  await expect(page.getByTestId("event-card")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.help}`);
  expect(blocking).toEqual([]);
});
