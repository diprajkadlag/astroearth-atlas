import { expect, test, type Page } from "@playwright/test";

/**
 * Milestone M5: the Koorma Chakra, eclipses on the globe and the great
 * conjunctions. Checks read the debug hook and the page text, never pixels.
 */

type KoormaDebug = {
  frames: number;
  koorma: { mode: string; strengths: Record<string, number>; litNakshatras: number[]; uniform: number[] };
  projectGeo(latitudeDeg: number, longitudeDeg: number): { x: number; y: number; facing: boolean };
};

const koorma = (page: Page) =>
  page.evaluate(() => (window as Window & { __MEDINI_DEBUG__?: KoormaDebug }).__MEDINI_DEBUG__?.koorma ?? null);

test.describe("Koorma Chakra", () => {
  test("lights the west on the globe and in the legend after the eclipse of 14 December 2020", async ({ page, isMobile }) => {
    await page.goto("/#d=2020-12-21");
    await expect.poll(async () => (await koorma(page))?.strengths.west).toBe(3);
    const debug = await koorma(page);
    expect(debug?.mode).toBe("global");
    // Jyeshtha (17) carries the eclipse arc on the ring.
    expect(debug?.litNakshatras).toContain(17);
    // The shader reads the centre, then the wedges from north: the west is index 7.
    expect(debug?.uniform).toEqual([1, 0, 1, 0, 0, 0, 0, 3, 1]);
    const west = page.getByTestId("koorma-lit").locator('[data-region="west"]');
    await expect(west).toHaveAttribute("data-strength", "3");
    await expect(west).toContainText("West: Jyeshtha, Mula, Purva Ashadha");
    await expect(west).toContainText("Solar eclipse in Jyeshtha on 14 December 2020.");
    await expect(page.getByTestId("koorma-lit").locator('[data-region="centre"]')).toContainText("Rahu is in Mrigashira.");
    if (!isMobile) {
      // Desktop: one line under the sky table, without scrolling to the panel.
      await expect(page.getByTestId("koorma-summary")).toContainText("West (eclipse), Centre (transit)");
    }
  });

  test("a tap on a touch screen names the region under the finger", async ({ page, isMobile }) => {
    test.skip(!isMobile, "This check is for touch screens.");
    await page.goto("/#d=2020-12-21&koorma=classical");
    await expect.poll(async () => (await koorma(page))?.mode).toBe("classical");
    const scene = page.getByTestId("scene");
    await scene.scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: /Turn on touch control/ }).click();
    const box = await scene.boundingBox();
    if (!box) throw new Error("The scene has no box.");
    const karachi = await page.evaluate(() => (window as Window & { __MEDINI_DEBUG__?: KoormaDebug }).__MEDINI_DEBUG__?.projectGeo(24.86, 67.01));
    expect(karachi?.facing).toBe(true);
    await page.touchscreen.tap(box.x + (karachi?.x ?? 0), box.y + (karachi?.y ?? 0));
    await expect(page.getByTestId("koorma-tooltip")).toContainText("West: Jyeshtha, Mula, Purva Ashadha");
  });

  test("switches to the classical mode and keeps it in the link", async ({ page }) => {
    await page.goto("/#d=2020-12-21");
    const panel = page.getByTestId("koorma");
    await panel.getByRole("button", { name: "Classical" }).click();
    await expect(panel.getByRole("button", { name: "Classical" })).toHaveAttribute("aria-pressed", "true");
    await expect(panel).toContainText("within 25° of it");
    await expect.poll(async () => (await koorma(page))?.mode).toBe("classical");
    await expect.poll(() => page.evaluate(() => window.location.hash)).toContain("koorma=classical");
  });

  test("names the region under the pointer", async ({ page, isMobile }) => {
    test.skip(isMobile, "Phones read the region with a tap after they unlock the view.");
    await page.goto("/#d=2020-12-21&koorma=classical");
    await expect.poll(async () => (await koorma(page))?.mode).toBe("classical");
    const scene = page.getByTestId("scene");
    await scene.scrollIntoViewIfNeeded();
    const box = await scene.boundingBox();
    if (!box) throw new Error("The scene has no box.");
    // Karachi: west of Mathura, inside the classical chakra.
    const karachi = await page.evaluate(() => (window as Window & { __MEDINI_DEBUG__?: KoormaDebug }).__MEDINI_DEBUG__?.projectGeo(24.86, 67.01));
    expect(karachi?.facing).toBe(true);
    await page.mouse.move(box.x + (karachi?.x ?? 0), box.y + (karachi?.y ?? 0));
    const tooltip = page.getByTestId("koorma-tooltip");
    await expect(tooltip).toContainText("West: Jyeshtha, Mula, Purva Ashadha");
    await expect(tooltip).toContainText("Solar eclipse in Jyeshtha");
    // A place on the visible globe far from India lies outside the classical chakra.
    const far = await page.evaluate(() => {
      const debug = (window as Window & { __MEDINI_DEBUG__?: KoormaDebug }).__MEDINI_DEBUG__;
      const candidates: [number, number][] = [[-30, 25], [40, 140], [-25, 135], [5, 20], [60, 60]];
      return candidates.map(([lat, lon]) => debug?.projectGeo(lat, lon)).find((point) => point?.facing) ?? null;
    });
    if (far) {
      await page.mouse.move(box.x + far.x, box.y + far.y);
      await expect(tooltip).toContainText("Outside the classical chakra");
    }
    await page.mouse.move(box.x + 4, box.y + 4);
    await expect(tooltip).toHaveCount(0);
  });

  test("an eclipse card names the Koorma region of its nakshatra", async ({ page }) => {
    await page.goto("/#d=2020-12-14&event=solar-eclipse-2020-12-14");
    await expect(page.getByTestId("event-card")).toContainText(
      "Koorma Chakra: Jyeshtha belongs to the West region (Brihat Samhita 14.20–21).",
    );
    // A penumbral lunar eclipse has a pin, but it lights no region.
    await page.goto("/#d=2020-11-30&event=lunar-eclipse-2020-11-30");
    await expect(page.getByTestId("event-card")).toContainText("A penumbral eclipse does not light the region on the globe.");
  });
});

test.describe("great conjunctions", () => {
  test("list the conjunctions from 1000 to 2100, with Julian dates before 1582", async ({ page }) => {
    await page.goto("/#d=2020-12-21");
    const panel = page.getByTestId("great-conjunctions");
    await expect(panel.getByRole("img", { name: /The element of each conjunction/ })).toBeVisible();
    const row1345 = panel.locator("tbody tr", { hasText: "24 March 1345 (Julian)" });
    await expect(row1345).toContainText("24 March 1345 (Julian), approximate");
    await expect(row1345).toContainText("Aquarius 4°18′ (air)");
    await expect(panel.locator("tbody tr")).toHaveCount(68);
  });

  test("show a conjunction inside 1900 to 2050 in the sky", async ({ page }) => {
    await page.goto("/#d=2000-01-01");
    const panel = page.getByTestId("great-conjunctions");
    await panel.getByRole("button", { name: "Show the conjunction of 21 December 2020 in the sky" }).click();
    await expect(page.getByTestId("current-date")).toHaveText("21 December 2020");
    await expect(page.getByTestId("event-card")).toContainText("Jupiter–Saturn conjunction in Capricorn");
  });
});
