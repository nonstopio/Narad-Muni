/**
 * Self-check for the devotion streak. Run both:
 *   npx tsx src/lib/streak.test.ts
 *   TZ=America/Los_Angeles npx tsx src/lib/streak.test.ts
 */

import assert from "node:assert";
import { computeStreak, updateKeysOf } from "./streak";

const set = (...k: string[]) => new Set(k);
const none = set();

// A run of updates (Mon 2026-09-28 .. Thu 2026-10-01).
assert.strictEqual(computeStreak(set("2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"), none, "2026-10-01"), 4);

// Leave in the middle keeps the streak and does not count.
assert.strictEqual(computeStreak(set("2026-09-28", "2026-09-29", "2026-10-01"), set("2026-09-30"), "2026-10-01"), 3);

// Today on leave, yesterday updated → 1.
assert.strictEqual(computeStreak(set("2026-09-30"), set("2026-10-01"), "2026-10-01"), 1);

// Today empty → 0 (existing rule).
assert.strictEqual(computeStreak(set("2026-09-30"), none, "2026-10-01"), 0);

// A weekend gap without updates breaks it (existing rule).
assert.strictEqual(computeStreak(set("2026-09-25", "2026-09-28"), none, "2026-09-28"), 1);

// A week spanning the EU DST change (2026-10-25).
assert.strictEqual(
  computeStreak(set("2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"), none, "2026-10-26"),
  5
);

// Only leave → 0, and leave alone never loops forever.
assert.strictEqual(computeStreak(none, set("2026-10-01", "2026-09-30"), "2026-10-01"), 0);

// Stored update dates are UTC midnight. West of UTC, `new Date(iso).setHours(0)`
// used to shift them to the previous local day; the key must not move.
const keys = updateKeysOf([{ date: "2026-10-01T00:00:00.000Z" }, { date: "2026-09-30T00:00:00.000Z" }]);
assert.deepStrictEqual([...keys].sort(), ["2026-09-30", "2026-10-01"]);
assert.strictEqual(computeStreak(keys, none, "2026-10-01"), 2);

console.log(`streak: all assertions passed (TZ=${Intl.DateTimeFormat().resolvedOptions().timeZone})`);
