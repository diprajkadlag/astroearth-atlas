// Refuses to publish while a document page still holds a [TODO: ...] marker.
// The Impressum and the privacy page need the owner's own details first.
// Runs after `npm run build` in the Pages workflow: `npm run release-check`.
import { existsSync, readdirSync, readFileSync } from "node:fs";

const folder = new URL("../dist/pages/", import.meta.url);
if (!existsSync(folder)) {
  console.error("No dist/pages folder. Run `npm run build` first.");
  process.exit(1);
}
const problems = [];
for (const name of readdirSync(folder).filter((file) => file.endsWith(".html"))) {
  const count = (readFileSync(new URL(name, folder), "utf8").match(/\[TODO/g) ?? []).length;
  if (count > 0) problems.push(`${name}: ${count} [TODO] marker(s)`);
}
if (problems.length > 0) {
  console.error(`Not ready to publish:\n${problems.join("\n")}`);
  process.exit(1);
}
console.log("Release check passed: no [TODO] marker in the document pages.");
