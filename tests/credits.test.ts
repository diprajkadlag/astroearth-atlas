import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Folders whose files come from outside this repository's own code. */
const GUARDED_FOLDERS = ["public/textures", "public/fonts", "public/data"];

function listFiles(folder: string): string[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

describe("CREDITS.md", () => {
  it("has a row for every shipped texture, font and data file", () => {
    const credits = readFileSync(join(ROOT, "CREDITS.md"), "utf8");
    const files = GUARDED_FOLDERS.flatMap((folder) =>
      listFiles(join(ROOT, folder)),
    ).map((path) => relative(ROOT, path).split(sep).join("/"));

    const missing = files.filter((file) => !credits.includes(`| ${file} |`));

    expect(missing, "add a row (source, license, URL) for each file").toEqual([]);
  });
});
