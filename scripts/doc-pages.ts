import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Marked, type Tokens } from "marked";
import type { Plugin } from "vite";

import { en } from "../src/i18n/en.ts";

/**
 * The document pages of the site (plan, M6): About, Method, Privacy, Impressum
 * and Credits. Each page is a small HTML entry in pages/ with a placeholder
 * <!--page:name-->. At build time (and in the dev server) this plugin renders
 * the Markdown source into it, with the same header, navigation and footer on
 * every page. No JavaScript ships with these pages, and marked runs only here.
 */

export type DocPageName = "about" | "method" | "privacy" | "impressum" | "credits";

export interface DocPage {
  name: DocPageName;
  title: string;
  /** Markdown source, relative to the project root. */
  source: string;
}

export const DOC_PAGES: readonly DocPage[] = [
  { name: "about", title: en.pageAbout, source: "src/content/en/about.md" },
  { name: "method", title: en.pageMethod, source: "docs/METHOD.md" },
  { name: "privacy", title: en.pagePrivacy, source: "src/content/en/privacy.md" },
  { name: "impressum", title: en.pageImpressum, source: "src/content/en/impressum.md" },
  { name: "credits", title: en.pageCredits, source: "src/content/en/credits.md" },
];

const PLACEHOLDER = /<!--page:([a-z]+)-->/;
/** <!-- table:CREDITS.md --> takes the table of that file, so the credits have one source. */
const TABLE_INCLUDE = /<!-- table:([A-Za-z0-9_./-]+\.md) -->/g;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** "Koorma Chakra" -> "koorma-chakra": ids for links such as method.html#koorma-chakra. */
export function slug(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .toLowerCase()
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createMarked(): Marked {
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({
    renderer: {
      heading(this: { parser: { parseInline(tokens: Tokens.Generic[]): string } }, token: Tokens.Heading) {
        const text = this.parser.parseInline(token.tokens);
        return `<h${token.depth} id="${slug(text)}">${text}</h${token.depth}>\n`;
      },
      link(this: { parser: { parseInline(tokens: Tokens.Generic[]): string } }, token: Tokens.Link) {
        const text = this.parser.parseInline(token.tokens);
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
        // Links to other sites send no referrer (product rule 2: nothing leaves without the reader's click).
        const external = /^https?:\/\//.test(token.href) ? ' rel="noopener noreferrer"' : "";
        return `<a href="${escapeHtml(token.href)}"${title}${external}>${text}</a>`;
      },
    },
  });
  return marked;
}

/** The Markdown of a page, with included tables. */
export function pageMarkdown(root: string, page: DocPage): string {
  const markdown = readFileSync(resolve(root, page.source), "utf8");
  return markdown.replace(TABLE_INCLUDE, (_match, file: string) =>
    readFileSync(resolve(root, file), "utf8")
      .split("\n")
      .filter((line) => line.startsWith("|"))
      .join("\n"),
  );
}

export function renderPage(root: string, page: DocPage): string {
  // A wide table scrolls inside a focusable region, so keyboard users can scroll it too.
  const body = createMarked()
    .parse(pageMarkdown(root, page), { async: false })
    .replace(/<table>/g, `<div class="table-scroll" tabindex="0" role="region" aria-label="${escapeHtml(en.pageTable)}"><table>`)
    .replace(/<\/table>/g, "</table></div>");
  const nav = DOC_PAGES.map(
    (item) =>
      `<li><a href="${item.name}.html"${item.name === page.name ? ' aria-current="page"' : ""}>${escapeHtml(item.title)}</a></li>`,
  ).join("");
  return [
    `<header class="page-header">`,
    `<a class="page-home" href="../">${escapeHtml(en.appName)}</a>`,
    `<nav aria-label="${escapeHtml(en.pagesNav)}"><ul>${nav}</ul></nav>`,
    `</header>`,
    `<main class="doc">${body}</main>`,
    `<footer class="page-footer">`,
    `<p>${escapeHtml(en.disclaimer)}</p>`,
    `<p><a href="../">${escapeHtml(en.pageBack)}</a></p>`,
    `</footer>`,
  ].join("\n");
}

export function docPages(): Plugin {
  let root = process.cwd();
  return {
    name: "astroearth-atlas:doc-pages",
    configResolved(config) {
      root = config.root;
    },
    transformIndexHtml(html) {
      const match = PLACEHOLDER.exec(html);
      if (!match) return html;
      const page = DOC_PAGES.find((item) => item.name === match[1]);
      if (!page) throw new Error(`Unknown document page: ${match[1]}`);
      const title = en.pageTitle.replace("{page}", page.title).replace("{app}", en.appName);
      return html
        .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
        .replace(match[0], renderPage(root, page));
    },
    configureServer(server) {
      // The dev server reloads a page when its Markdown changes.
      const sources = new Set(DOC_PAGES.map((page) => resolve(root, page.source)));
      sources.add(resolve(root, "CREDITS.md"));
      server.watcher.add([...sources]);
      server.watcher.on("change", (file) => {
        if (sources.has(resolve(file))) server.ws.send({ type: "full-reload" });
      });
    },
  };
}

/** The HTML entries for Rollup: the app and the document pages. */
export function pageInputs(root: string): Record<string, string> {
  return Object.fromEntries([
    ["main", resolve(root, "index.html")],
    ...DOC_PAGES.map((page) => [page.name, resolve(root, "pages", `${page.name}.html`)]),
  ]);
}
