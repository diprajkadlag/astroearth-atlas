import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow, recordForeignRequests } from "./helpers.ts";

/**
 * Milestone M6: the document pages (scripts/doc-pages.ts). Each page has the
 * app's security policy, the shared navigation, no foreign requests and no
 * serious accessibility problem.
 */

const PAGES = [
  { file: "about", title: "About", heading: "About AstroEarth Atlas" },
  { file: "method", title: "Method", heading: "Method" },
  { file: "privacy", title: "Privacy", heading: "Privacy" },
  { file: "credits", title: "Credits", heading: "Credits" },
] as const;

test.describe("document pages", () => {
  for (const page of PAGES) {
    test(`${page.title}: loads with the navigation, the policy and no foreign requests`, async ({ page: browser, baseURL }) => {
      const foreign = recordForeignRequests(browser, new URL(baseURL ?? "http://127.0.0.1").origin);
      await browser.goto(`/pages/${page.file}.html`);
      await expect(browser).toHaveTitle(`${page.title}: AstroEarth Atlas`);
      await expect(browser.getByRole("heading", { level: 1, name: page.heading })).toBeVisible();
      const nav = browser.getByRole("navigation", { name: "About this site" });
      await expect(nav.getByRole("link", { name: page.title })).toHaveAttribute("aria-current", "page");
      const policy = await browser.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
      expect(policy).toContain("default-src 'self'");
      await expect(browser.locator("footer").getByText("It does not predict events")).toBeVisible();
      await browser.waitForLoadState("networkidle");
      expect(foreign, `requests to other origins:\n${foreign.join("\n")}`).toEqual([]);
      const results = await new AxeBuilder({ page: browser }).analyze();
      const blocking = results.violations
        .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
        .map((violation) => `${violation.id}: ${violation.help}`);
      expect(blocking).toEqual([]);
    });
  }

  test("the Method page fits the viewport and passes the accessibility scan", async ({ page }) => {
    await page.goto("/pages/method.html");
    await expectNoHorizontalOverflow(page);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations
      .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
      .map((violation) => `${violation.id}: ${violation.help}`);
    expect(blocking).toEqual([]);
  });

  test("the Credits page holds the table of CREDITS.md and fits the viewport", async ({ page }) => {
    await page.goto("/pages/credits.html");
    await expect(page.getByRole("cell", { name: "public/favicon.svg" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("the app links to the pages, and the Koorma panel to its method section", async ({ page }) => {
    await page.goto("/#d=2020-12-21");
    await expect(page.getByTestId("koorma").getByRole("link", { name: "How the Koorma Chakra is drawn" })).toHaveAttribute(
      "href",
      "pages/method.html#koorma-chakra",
    );
    await page.getByRole("navigation", { name: "About this site" }).getByRole("link", { name: "Method" }).click();
    await expect(page).toHaveTitle("Method: AstroEarth Atlas");
    await page.getByRole("link", { name: "Back to the atlas" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "AstroEarth Atlas" })).toBeVisible();
  });
});
