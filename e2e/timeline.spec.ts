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
    // DESIGN.md, Earth motion: a jump to an event shows the event's own time.
    await expect
      .poll(() =>
        page.evaluate(() => (window as Window & { __ASTROEARTH_DEBUG__?: { earthInstantMs: number } }).__ASTROEARTH_DEBUG__?.earthInstantMs),
      )
      .toBe(Date.UTC(2020, 11, 21, 18, 26));
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

test.describe("world events and controls", () => {
  test("a click on a world-event diamond opens its card", async ({ page }) => {
    // A 1-year span around Apollo 11 (20 July 1969, 20:17 UTC).
    await page.goto("/#d=1969-07-01&from=1969-01-01&to=1970-01-01");
    const lanes = page.getByRole("img", { name: /Sidereal longitude of/ });
    await lanes.scrollIntoViewIfNeeded();
    const box = await lanes.boundingBox();
    if (!box) throw new Error("The lanes have no box.");
    // Same layout as src/timeline/plot.ts: the track sits at the top, the plot from x0 to x1.
    const x0 = box.width < 560 ? 8 : 112;
    const x1 = box.width - 14;
    const start = Date.UTC(1969, 0, 1);
    const end = Date.UTC(1970, 0, 1);
    const x = x0 + ((Date.UTC(1969, 6, 20, 20, 17) - start) / (end - start)) * (x1 - x0);
    await page.mouse.click(box.x + x, box.y + 14);
    const card = page.getByTestId("event-card");
    await expect(card).toContainText("Apollo 11 lands on the Moon");
    await expect(card.getByRole("link", { name: /Wikidata Q43653/ })).toBeVisible();
    await expect(page.getByRole("slider", { name: "Date" })).toHaveAttribute("aria-valuetext", "20 July 1969, 20:17 UTC");
  });

  test("a day event card shows the local date and the Moon's range for that day", async ({ page }) => {
    await page.goto("/#d=1984-12-01&event=bhopal-1984");
    const card = page.getByTestId("event-card");
    await expect(card).toContainText("Bhopal gas disaster");
    await expect(card).toContainText("3 December 1984");
    await expect(card).toContainText("During that day the Moon moved from");
  });

  test("the world-event list opens a card and sets the date", async ({ page }) => {
    await page.goto("/#d=2000-01-01");
    await page.getByTestId("world-events").getByRole("button", { name: /India becomes independent/ }).click();
    await expect(page.getByTestId("event-card")).toContainText("India becomes independent");
    await expect(page.getByTestId("current-date")).toHaveText("15 August 1947");
  });

  test("a future date shows the banner of product rule 2", async ({ page }) => {
    await page.goto("/#d=2049-06-01");
    await expect(page.getByText("Future dates show calculated sky positions only.")).toBeVisible();
  });

  test("Space on the ruler plays and pauses", async ({ page }) => {
    await page.goto("/#d=2020-12-21");
    const ruler = page.getByRole("slider", { name: "Date" });
    await ruler.focus();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("play")).toHaveText("Pause");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("play")).toHaveText("Play");
  });

  test("Ctrl with the mouse wheel zooms the lanes", async ({ page, isMobile }) => {
    test.skip(isMobile, "Phones have no mouse wheel.");
    await page.goto("/#d=2020-12-21&from=2014-12-21&to=2026-12-21");
    const lanes = page.getByRole("img", { name: /Sidereal longitude of/ });
    await lanes.scrollIntoViewIfNeeded();
    const box = await lanes.boundingBox();
    if (!box) throw new Error("The lanes have no box.");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -120);
    await page.keyboard.up("Control");
    await expect.poll(() => page.evaluate(() => window.location.hash)).not.toContain("from=2014-12-21");
  });

  test("Shift with the mouse wheel pans the lanes and keeps the zoom", async ({ page, isMobile }) => {
    test.skip(isMobile, "Phones have no mouse wheel.");
    await page.goto("/#d=2020-12-21&from=2014-12-21&to=2026-12-21");
    const lanes = page.getByRole("img", { name: /Sidereal longitude of/ });
    await lanes.scrollIntoViewIfNeeded();
    const box = await lanes.boundingBox();
    if (!box) throw new Error("The lanes have no box.");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down("Shift");
    await page.mouse.wheel(0, 120);
    await page.keyboard.up("Shift");
    await expect.poll(() => hash(page)).not.toContain("from=2014-12-21");
    // One wheel step pans by a tenth of the 12-year span, later in time.
    const fromYear = Number(/from=(\d{4})/.exec(await hash(page))?.[1]);
    const toYear = Number(/to=(\d{4})/.exec(await hash(page))?.[1]);
    expect(fromYear).toBe(2016);
    expect(toYear - fromYear).toBe(12);
  });

  test("touch devices start with the 3D view locked", async ({ page, isMobile }) => {
    await page.goto("/#d=2020-12-21");
    const unlock = page.getByRole("button", { name: /Turn on touch control/ });
    if (isMobile) {
      await expect(unlock).toBeVisible();
      await unlock.click();
      await expect(page.getByRole("button", { name: /Turn off touch control/ })).toBeVisible();
    } else {
      await expect(unlock).toHaveCount(0);
    }
  });
});
