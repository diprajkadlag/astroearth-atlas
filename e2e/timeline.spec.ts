import { expect, test, type Page } from "@playwright/test";

/**
 * Milestone M4: the full timeline, events and panels. Checks read the page
 * state (the share link, the slider, the card), not pixels.
 */

async function hash(page: Page): Promise<string> {
  return page.evaluate(() => decodeURIComponent(window.location.hash));
}

test.describe("timeline", () => {
  test("switches between the Lanes and Cycles views, and keeps the choice in the link", async ({ page }) => {
    await page.goto("/#d=2020-12-21&from=2010-01-01&to=2032-01-01");
    await expect(page.getByRole("img", { name: /Sidereal longitude of/ })).toBeVisible();
    await page.getByRole("button", { name: "Cycles" }).click();
    await expect(page.getByRole("button", { name: "Cycles" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("img", { name: /Cycles of Jupiter and Saturn/ })).toBeVisible();
    await expect.poll(() => hash(page)).toContain("view=cycles");
  });

  test("lets you choose up to 4 cycle pairs", async ({ page }) => {
    await page.goto("/#d=2020-12-21&view=cycles");
    await page.getByText("Choose pairs").click();
    for (const name of ["Saturn and Rahu", "Mars and Saturn", "Jupiter and Rahu"]) {
      await page.getByRole("checkbox", { name }).check();
    }
    // The 5th pair cannot be added.
    await expect(page.getByRole("checkbox", { name: "Mars and Jupiter" })).toBeDisabled();
    await expect.poll(() => hash(page)).toContain("pairs=jupiter-saturn,saturn-rahu,mars-saturn,jupiter-rahu");
  });

  test("zooms down to 1 day and steps by the hour", async ({ page }) => {
    await page.goto("/#d=2020-12-21&from=2020-12-01&to=2021-01-01");
    for (let index = 0; index < 6; index += 1) await page.getByRole("button", { name: "Zoom in" }).click();
    const ruler = page.getByRole("slider", { name: "Date" });
    await ruler.focus();
    await page.keyboard.press("ArrowRight");
    await expect(ruler).toHaveAttribute("aria-valuetext", "21 December 2020, 01:00 UTC");
  });

  test("jumps to the next and previous events", async ({ page }) => {
    await page.goto("/#d=2020-12-15&from=2019-12-15&to=2021-12-15");
    const ruler = page.getByRole("slider", { name: "Date" });
    // Wait for the sky events: the next event after 15 December 2020 is the great conjunction.
    await expect(page.getByRole("button", { name: "Next event" })).toBeEnabled();
    await page.getByRole("button", { name: "Next event" }).click();
    await expect(page.getByTestId("event-card")).toContainText("Jupiter–Saturn conjunction in Capricorn");
    await expect(ruler).toHaveAttribute("aria-valuetext", "21 December 2020, 18:26 UTC");
    await page.getByRole("button", { name: "Previous event" }).click();
    await expect(page.getByTestId("event-card")).toContainText("Total solar eclipse");
    await expect(ruler).toHaveAttribute("aria-valuetext", "14 December 2020, 16:13 UTC");
  });

  test("a sky moment jumps to its date", async ({ page }) => {
    await page.goto("/#d=2020-12-21");
    await page.getByRole("button", { name: /Eight grahas in Capricorn/ }).click();
    await expect(page.getByTestId("current-date")).toHaveText("5 February 1962");
    await expect(page.locator('[data-graha="ketu"]')).toContainText("Capricorn");
  });

  test("live mode follows the clock and leaves on a date change", async ({ page }) => {
    await page.goto("/#d=2020-12-21");
    const live = page.getByRole("button", { name: "Live" });
    await live.click();
    await expect(live).toHaveAttribute("aria-pressed", "true");
    const year = String(new Date().getUTCFullYear());
    await expect(page.getByTestId("current-date")).toContainText(year);
    const ruler = page.getByRole("slider", { name: "Date" });
    await ruler.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(live).toHaveAttribute("aria-pressed", "false");
  });

  test("the brush pans the span", async ({ page }) => {
    await page.goto("/#d=2020-12-21&from=2015-01-01&to=2027-01-01");
    const ruler = page.getByRole("slider", { name: "Date" });
    await ruler.scrollIntoViewIfNeeded();
    const box = await ruler.boundingBox();
    if (!box) throw new Error("The ruler has no box.");
    // Drag the band (upper part of the ruler) 60 px to the left.
    const pxPerYear = (box.width - 20) / 151;
    const bandCentre = box.x + 10 + (2021 - 1900) * pxPerYear;
    await page.mouse.move(bandCentre, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(bandCentre - 60, box.y + 10, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => hash(page)).not.toContain("from=2015-01-01");
    const fromYear = Number(/from=(\d{4})/.exec(await hash(page))?.[1]);
    expect(fromYear).toBeLessThan(2015);
  });
});

test.describe("panels", () => {
  test("shows yuti, graha yuddha and combustion for the great conjunction", async ({ page }) => {
    await page.goto("/#d=2020-12-21");
    const rules = page.getByTestId("rules");
    await expect(rules).toContainText("Jupiter and Saturn, 0°05′ apart.");
    await expect(rules).toContainText("Mercury, 0°29′ from the Sun");
  });

  test("announces the date in a polite live region", async ({ page }) => {
    await page.goto("/#d=2020-12-21");
    const live = page.getByTestId("live-summary");
    await expect(live).toHaveAttribute("aria-live", "polite");
    await expect(live).toContainText("21 December 2020");
    await expect(live).toContainText("Jupiter and Saturn in conjunction");
  });

  test("opens an eclipse card from a link, with its calculated facts", async ({ page }) => {
    await page.goto("/#d=2020-12-14&event=solar-eclipse-2020-12-14");
    const card = page.getByTestId("event-card");
    await expect(card).toContainText("Total solar eclipse");
    await expect(card).toContainText("The Sun stands in Jyeshtha.");
    await card.getByRole("button", { name: "Close" }).click();
    await expect(card).toHaveCount(0);
  });

  test("offers full screen for the scene", async ({ page }) => {
    await page.goto("/#d=2020-12-21");
    const supported = await page.evaluate(() => document.fullscreenEnabled);
    test.skip(!supported, "This browser offers no fullscreen.");
    await expect(page.getByRole("button", { name: "Full screen" })).toBeVisible();
  });
});
