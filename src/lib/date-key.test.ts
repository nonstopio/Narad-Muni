/**
 * Self-check for YYYY-MM-DD day keys. Run: npx tsx src/lib/date-key.test.ts
 */

import assert from "node:assert";
import { isDateKey, prevDateKey, updateDateIso } from "./date-key";

assert.ok(isDateKey("2026-10-01"));
assert.ok(isDateKey("2028-02-29"), "leap day");
assert.ok(!isDateKey("2026-02-30"), "no Feb 30");
assert.ok(!isDateKey("2026-02-29"), "2026 is not a leap year");
assert.ok(!isDateKey("2026-1-5"), "unpadded");
assert.ok(!isDateKey("2026-13-01"), "month 13");
assert.ok(!isDateKey("2026-10-01T00:00:00.000Z"), "full ISO");
assert.ok(!isDateKey(""));
assert.ok(!isDateKey(undefined));
assert.ok(!isDateKey(20261001));

assert.strictEqual(prevDateKey("2026-10-01"), "2026-09-30", "month boundary");
assert.strictEqual(prevDateKey("2026-01-01"), "2025-12-31", "year boundary");
assert.strictEqual(prevDateKey("2028-03-01"), "2028-02-29", "leap day");
assert.strictEqual(prevDateKey("2026-03-01"), "2026-02-28", "non-leap");
assert.strictEqual(prevDateKey("2026-03-30"), "2026-03-29", "EU DST change");

// Must equal what POST /api/updates has always stored: new Date(key).toISOString().
assert.strictEqual(updateDateIso("2026-10-01"), "2026-10-01T00:00:00.000Z");
assert.strictEqual(updateDateIso("2026-10-01"), new Date("2026-10-01").toISOString());

console.log("date-key: all assertions passed");
