/**
 * Self-check for the Orb loaders. Run: npx tsx src/components/ui/orb.test.ts
 * Orbs must follow the app theme (<html data-theme>), stay quiet for screen
 * readers when text beside them already speaks, and replace every old spinner.
 */

import assert from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Orb } from "./orb";

// Decorative by default: hidden from assistive tech.
const quiet = renderToStaticMarkup(createElement(Orb, { state: "searching" }));
assert.match(quiet, /<canvas/, "renders a canvas");
assert.match(quiet, /aria-hidden="true"/, "unlabelled orb is aria-hidden");

// Labelled: announced, not hidden.
const named = renderToStaticMarkup(createElement(Orb, { state: "breathing", size: 32, label: "Consulting the oracle" }));
assert.match(named, /aria-label="Consulting the oracle"/, "label becomes aria-label");
assert.doesNotMatch(named, /aria-hidden/, "labelled orb is not hidden");

const src = join(process.cwd(), "src");
const files = (readdirSync(src, { recursive: true }) as string[])
  .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => ({ f, text: readFileSync(join(src, f), "utf8") }));

// Theme follows the app: the root marks it, and nothing pins it per orb.
assert.match(readFileSync(join(src, "app/layout.tsx"), "utf8"), /<html[^>]*data-theme="dark"/, "root sets data-theme");
for (const { f, text } of files) {
  if (text.includes('"thinking-orbs"')) assert.ok(f.endsWith("components/ui/orb.tsx"), `${f} must use Orb, not thinking-orbs directly`);
}
assert.doesNotMatch(readFileSync(join(src, "components/ui/orb.tsx"), "utf8"), /theme=/, "Orb must not pin a theme");

// No old spinners left behind.
for (const { f, text } of files) {
  assert.doesNotMatch(text, /\bLoader2\b|animate-spin/, `${f} still uses a spinner; use <Orb>`);
}

console.log("orb: all checks passed");
