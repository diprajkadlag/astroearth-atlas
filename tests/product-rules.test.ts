import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TEXT = new Set([".ts", ".tsx", ".css", ".html", ".json", ".svg", ".txt", ".md"]);

function textFiles(folder: string): string[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return textFiles(path);
    return TEXT.has(extname(name)) ? [path] : [];
  });
}

describe("product rules (CLAUDE.md)", () => {
  it("rule 6: names the inspiring speaker only in the README credit line, never in the app", () => {
    // Built from parts, so this test file does not contain the name itself.
    const name = ["Abh" + "igya", "An" + "and"];
    // The document pages render docs/METHOD.md and the table of CREDITS.md too.
    const files = [
      ...textFiles(join(ROOT, "src")),
      ...textFiles(join(ROOT, "public")),
      ...textFiles(join(ROOT, "pages")),
      join(ROOT, "index.html"),
      join(ROOT, "package.json"),
      join(ROOT, "docs", "METHOD.md"),
      join(ROOT, "CREDITS.md"),
    ];
    const hits = files.filter((file) => {
      const text = readFileSync(file, "utf8");
      return text.includes(name[0] as string) || text.includes(name.join(" "));
    });
    expect(hits.map((file) => relative(ROOT, file).split(sep).join("/"))).toEqual([]);
  });

  it("rule 2: loads nothing from other origins in the page source", () => {
    for (const file of [join(ROOT, "index.html"), ...textFiles(join(ROOT, "pages"))]) {
      const html = readFileSync(file, "utf8");
      expect(html, file).not.toMatch(/<(script|link)[^>]+(src|href)="https?:\/\//i);
    }
    for (const file of textFiles(join(ROOT, "src")).filter((path) => path.endsWith(".css"))) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/url\(\s*["']?https?:\/\//i);
    }
  });
});
