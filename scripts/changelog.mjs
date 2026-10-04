// Prepends a release section to CHANGELOG.md, grouped from the conventional
// commits since the last tag. Used by the Release workflow.
//   node scripts/changelog.mjs <version> [lastTag]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SECTIONS = [
  ["breaking", "⚠️ Breaking Changes"],
  ["feat", "✨ Features"],
  ["fix", "🐛 Bug Fixes"],
  ["perf", "⚡ Performance"],
  ["refactor", "♻️ Refactoring"],
  ["docs", "📝 Documentation"],
];

export function section(version, date, commits) {
  const groups = Object.fromEntries(SECTIONS.map(([k]) => [k, []]));
  for (const { subject, body } of commits) {
    const m = subject.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);
    if (!m) continue; // non-conventional subjects stay out of the changelog
    const [, type, scope, bang, text] = m;
    const line = `- ${scope ? `**${scope}:** ` : ""}${text}`;
    if (bang || /^BREAKING CHANGE:/m.test(body)) groups.breaking.push(line);
    else if (groups[type]) groups[type].push(line);
  }
  const parts = SECTIONS.filter(([k]) => groups[k].length).map(
    ([k, title]) => `### ${title}\n${groups[k].join("\n")}`,
  );
  if (!parts.length) parts.push("### 🧹 Chores\n- Maintenance release.");
  return `## [${version}] - ${date}\n\n${parts.join("\n\n")}\n`;
}

export function prepend(changelog, entry) {
  const i = changelog.indexOf("\n## [");
  return i === -1
    ? `${changelog.trimEnd()}\n\n${entry}`
    : `${changelog.slice(0, i + 1)}${entry}\n${changelog.slice(i + 1)}`;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [version, last] = process.argv.slice(2);
  const range = last ? [`${last}..HEAD`] : ["HEAD"];
  const raw = execFileSync(
    "git",
    ["log", ...range, "--no-merges", "--format=%s%x1f%b%x1e"],
    { encoding: "utf8" },
  );
  const commits = raw
    .split("\x1e")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const [subject, body = ""] = c.split("\x1f");
      return { subject, body };
    });
  const date = new Date().toISOString().slice(0, 10);
  const file = "CHANGELOG.md";
  writeFileSync(file, prepend(readFileSync(file, "utf8"), section(version, date, commits)));
}
