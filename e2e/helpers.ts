import { expect, type Page } from "@playwright/test";

/**
 * Records every request that leaves the app's own origin. The app must make
 * none: fonts, textures and data ship with it (GDPR, see CLAUDE.md).
 */
export function recordForeignRequests(page: Page, appOrigin: string): string[] {
  const foreign: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.origin !== appOrigin) foreign.push(request.url());
  });
  return foreign;
}

/**
 * The document must never be wider than the viewport on a phone.
 *
 * Two checks, because either one alone can be fooled. The document's
 * scrollWidth misses content that an ancestor clips. Walking the elements
 * misses nothing, but it exempts elements inside deliberate scrollers.
 * (Adapted from VedicAstrologer, same author, MIT.)
 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    const limit = document.documentElement.clientWidth;
    const painted: string[] = [];

    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.right <= limit + 1) return;

      for (
        let parent = element.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        if (getComputedStyle(parent).overflowX !== "visible") return;
      }

      const id = element.id ? `#${element.id}` : "";
      painted.push(
        `${element.tagName.toLowerCase()}${id} reaches ${Math.round(box.right)}px`,
      );
    });

    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, painted };
  });

  expect(
    result.scrollWidth,
    `page scrolls to ${result.scrollWidth}px in a ${result.clientWidth}px viewport`,
  ).toBeLessThanOrEqual(result.clientWidth + 1);

  expect(
    result.painted,
    `elements painted past the right edge:\n${result.painted.join("\n")}`,
  ).toEqual([]);
}
