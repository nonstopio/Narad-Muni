/**
 * Self-check for the missive schedule math. Run: npx tsx src/lib/slack-dm.test.ts
 * No test framework — plain asserts, because the only tricky parts here are the
 * month-length clamp, the 120-day horizon, and skipping moments already past.
 */

import assert from "node:assert";
import { occurrences, renderTemplate } from "./slack-dm";

const DAY = 86400;
const nowSec = Math.floor(Date.now() / 1000);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) =>
  iso(new Date(Date.now() + n * DAY * 1000));

// Weekly: capped at 12, exactly 7 days apart, all in the future.
const weekly = occurrences(daysFromNow(1), "10:00", "weekly", "UTC");
assert.strictEqual(weekly.length, 12, "weekly should fill the 12-occurrence cap");
for (let i = 1; i < weekly.length; i++) {
  assert.strictEqual(weekly[i] - weekly[i - 1], 7 * DAY, "weekly gap must be 7 days");
}
assert.ok(weekly.every((t) => t > nowSec), "no occurrence may be in the past");

// A start date already gone by: past occurrences are skipped, not emitted.
const backdated = occurrences(daysFromNow(-30), "10:00", "weekly", "UTC");
assert.ok(backdated.length > 0, "a backdated weekly schedule still has a future tail");
assert.ok(backdated.every((t) => t > nowSec), "backdated run must skip past moments");

// Slack refuses anything beyond 120 days out.
const horizon = nowSec + 120 * DAY;
assert.ok(weekly.every((t) => t < horizon), "must stay inside Slack's 120-day horizon");

// Monthly on the 31st: clamps to each month's last day instead of spilling over.
const start = new Date(Date.now() + 5 * DAY * 1000);
start.setUTCDate(31); // rolls into next month for short months — that's fine as a start
const monthly = occurrences(iso(start), "10:00", "monthly", "UTC");
assert.ok(monthly.length > 0, "monthly should produce at least one occurrence");
for (const t of monthly) {
  const d = new Date(t * 1000);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const day = d.getUTCDate();
  assert.ok(
    day === 31 || day === lastDay,
    `monthly landed on day ${day}, expected 31 or month-end ${lastDay}`
  );
}

// Placeholders carry each recipient's own name.
assert.strictEqual(
  renderTemplate("Hi {{first_name}}, {{name}} — logs due", {
    id: "U1",
    name: "Ajay Kumar",
  }),
  "Hi Ajay, Ajay Kumar — logs due"
);

console.log("Narayan Narayan! Schedule math holds.");
