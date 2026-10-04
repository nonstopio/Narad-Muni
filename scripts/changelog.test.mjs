import assert from "node:assert/strict";
import { section, prepend } from "./changelog.mjs";

const out = section("1.17.0", "2026-10-04", [
  { subject: "feat(leave): mark a day as on leave", body: "" },
  { subject: "fix: never autosave early", body: "" },
  { subject: "chore: clear lint", body: "" },
  { subject: "feat!: drop old config", body: "" },
  { subject: "refactor: x", body: "BREAKING CHANGE: y" },
  { subject: "Merge stuff", body: "" },
]);
assert.equal(
  out,
  "## [1.17.0] - 2026-10-04\n\n" +
    "### ⚠️ Breaking Changes\n- drop old config\n- x\n\n" +
    "### ✨ Features\n- **leave:** mark a day as on leave\n\n" +
    "### 🐛 Bug Fixes\n- never autosave early\n",
);
assert.match(section("1.0.1", "d", [{ subject: "ci: x", body: "" }]), /Maintenance release/);

const log = "# Changelog\n\nintro\n\n## [1.16.0] - x\n\nold\n";
assert.equal(prepend(log, "## [1.17.0] - y\n\nnew\n"), "# Changelog\n\nintro\n\n## [1.17.0] - y\n\nnew\n\n## [1.16.0] - x\n\nold\n");
console.log("changelog ok");
