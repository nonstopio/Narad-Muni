/**
 * Self-check: leave never counts toward home stats. Run: npx tsx src/lib/month-stats.test.ts
 * Stats take updates only; leave lives in its own collection and has no input here.
 */

import assert from "node:assert";
import { monthStats } from "./month-stats";

const u = (date: string, secs?: number) => ({ date, metrics: secs === undefined ? undefined : { estTimeSavedSecs: secs } });

// Mon, Tue, Thu updated; Wed on leave (not an update) → 3 messages.
const stats = monthStats([u("2026-09-28T00:00:00.000Z", 600), u("2026-09-29T00:00:00.000Z", 600), u("2026-10-01T00:00:00.000Z", 1800)]);
assert.strictEqual(stats.messages, 3);
assert.strictEqual(stats.timeReclaimed, "50m");

// Updates without metrics fall back to 12 minutes each.
assert.strictEqual(monthStats([u("2026-10-01T00:00:00.000Z"), u("2026-10-02T00:00:00.000Z", 3600)]).timeReclaimed, "1h 12m");
assert.deepStrictEqual(monthStats([]), { messages: 0, timeReclaimed: "0m" });

console.log("month-stats: all assertions passed");
