import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TEXT = new Set([".ts", ".tsx", ".css", ".html", ".json", ".svg", ".txt", ".md", ".mjs", ".js", ".cjs", ".yml", ".yaml"]);
/** Folders that are not part of the repository's own text: dependencies, builds and test output. */
const SKIP = new Set(["node_modules", "dist", "e2e-artifacts", "test-results", "playwright-report", ".git"]);

function textFiles(folder: string): string[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return textFiles(path);
    return TEXT.has(extname(name)) ? [path] : [];
  });
}

describe("product rules (CLAUDE.md)", () => {
  it("rule 6: names the inspiring speaker only in the README credit line, nowhere else in the repository", () => {
    // Built from parts, so this test file does not contain the name itself.
    const name = ["Abh" + "igya", "An" + "and"];
    // Every text file of the repository, including .github and the docs, except the README.
    const files = textFiles(ROOT).filter((file) => relative(ROOT, file) !== "README.md");
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
