/**
 * Self-check for the day-total rules. Run: npx tsx src/lib/ai/time-rules.test.ts
 * The chosen hours are a floor: short days scale up to exactly the chosen hours
 * minus repeats, longer days keep their true total. 30-min steps, laid
 * back-to-back; repeats are never touched.
 */

import assert from "node:assert";
import { enforceTimeRules } from "./time-rules";
import type { ClaudeTimeEntry } from "@/types/claude";

const e = (issueKey: string, secs: number, started: string, isRepeat = false): ClaudeTimeEntry => ({
  issueKey, timeSpentSecs: secs, started, comment: "work", isRepeat,
});
const sum = (xs: ClaudeTimeEntry[]) => xs.reduce((s, x) => s + x.timeSpentSecs, 0);
const nonRepeat = (xs: ClaudeTimeEntry[]) => xs.filter((x) => !x.isRepeat);

const repeat = e("OPS-1", 3600, "2026-10-06T09:00:00", true);

// Scale up to 10h: 2h + 1h of AI time grows to fill 9h beside the 1h repeat.
const up = enforceTimeRules([repeat, e("A-1", 7200, "2026-10-06T10:00:00"), e("A-2", 3600, "2026-10-06T12:00:00")], 36000);
assert.strictEqual(sum(nonRepeat(up)), 36000 - 3600, "scale-up sums exactly to 10h minus repeats");
assert.deepStrictEqual(nonRepeat(up).map((x) => x.timeSpentSecs), [21600, 10800], "proportions kept");
assert.deepStrictEqual(up.find((x) => x.isRepeat), repeat, "repeat untouched");

// Above the floor: AI gave 11h with 9h chosen, so the true 11h is kept.
const down = enforceTimeRules(
  [e("B-1", 18000, "2026-10-06T10:00:00"), e("B-2", 14400, "2026-10-06T15:00:00"), e("B-3", 7200, "2026-10-06T19:00:00")],
  32400
);
assert.strictEqual(sum(down), 39600, "longer day is never shrunk");
assert.deepStrictEqual(down.map((x) => x.timeSpentSecs), [18000, 14400, 7200], "durations kept");

// Largest remainder: three equal-ish entries into 8h (16 units) must not drift.
const uneven = enforceTimeRules(
  [e("C-1", 1000, "2026-10-06T10:00:00"), e("C-2", 1000, "2026-10-06T11:00:00"), e("C-3", 1100, "2026-10-06T12:00:00")],
  28800
);
assert.strictEqual(sum(uneven), 28800, "rounded sum hits the target");
assert.ok(uneven.every((x) => x.timeSpentSecs % 1800 === 0 && x.timeSpentSecs >= 1800), "30-min steps, 30-min minimum");
assert.deepStrictEqual(uneven.map((x) => x.timeSpentSecs), [9000, 9000, 10800], "largest remainder (C-3) wins the spare unit");

// Tiny entries over a tiny floor: each still gets the 30-min minimum, and off-step times round.
const tight = enforceTimeRules(
  [e("D-1", 600, "2026-10-06T10:00:00"), e("D-2", 600, "2026-10-06T11:00:00"), e("D-3", 4500, "2026-10-06T12:00:00")],
  3600
);
assert.deepStrictEqual(tight.map((x) => x.timeSpentSecs), [1800, 1800, 5400]);

// All zero: split evenly.
const zero = enforceTimeRules([e("Z-1", 0, "2026-10-06T10:00:00"), e("Z-2", 0, "2026-10-06T10:00:00")], 14400);
assert.deepStrictEqual(zero.map((x) => x.timeSpentSecs), [7200, 7200]);

// Re-sequenced: contiguous from the first start, in the AI's order, no overlap, no zone.
const seq = nonRepeat(down);
assert.strictEqual(seq[0].started, "2026-10-06T10:00:00");
for (let i = 1; i < seq.length; i++) {
  const prevEnd = Date.parse(seq[i - 1].started + "Z") + seq[i - 1].timeSpentSecs * 1000;
  assert.strictEqual(Date.parse(seq[i].started + "Z"), prevEnd, "each entry starts when the previous ends");
}
assert.deepStrictEqual(seq.map((x) => x.issueKey), ["B-1", "B-2", "B-3"], "order kept");
assert.deepStrictEqual(up.map((x) => x.started), [...up.map((x) => x.started)].sort(), "merged with repeats, sorted by start");

console.log("time-rules: all assertions passed");
