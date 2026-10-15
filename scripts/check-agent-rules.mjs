import fs from "node:fs";
import path from "node:path";
const ignored = new Set(["node_modules", ".git", ".next", "dist", "dist-electron", ".claude", ".playwright-mcp"]);
let pairs = 0;
function check(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const names = new Set(entries.map((entry) => entry.name));
  if (names.has("CLAUDE.md") || names.has("AGENTS.md")) {
    if (!names.has("CLAUDE.md") || !names.has("AGENTS.md")) throw new Error(`Missing agent rules partner in ${directory}`);
    if (!fs.readFileSync(path.join(directory, "CLAUDE.md")).equals(fs.readFileSync(path.join(directory, "AGENTS.md")))) throw new Error(`Agent instructions differ in ${directory}`);
    pairs++;
  }
  for (const entry of entries) if (entry.isDirectory() && !ignored.has(entry.name)) check(path.join(directory, entry.name));
}
check(process.cwd());
console.log(`Agent rules: ${pairs} matching pair(s).`);
