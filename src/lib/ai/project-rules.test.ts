/**
 * Self-check for commit-sourced drafts. Run: npx tsx src/lib/ai/project-rules.test.ts
 * Commits are evidence of work, not of hours or tickets: nothing here may keep
 * a ticket the evidence never mentioned. The chosen hours still apply afterwards.
 */

import assert from "node:assert";
import { applyProjectSourceRules } from "./project-rules";
import { enforceTimeRules } from "./time-rules";
import type { ClaudeTimeEntry } from "@/types/claude";

const transcript = [
  "[Project activity · 2026-10-01 · Asia/Kolkata]",
  "Narad-Muni",
  "- 10:42 NM-12: add leave marker (a1b2c3d)",
  "- 14:05 fix: guard empty autosave (e4f5a6b) · refs NM-14",
  "[/Project activity]",
].join("\n");

const e = (issueKey: string, secs: number, started: string, isRepeat = false): ClaudeTimeEntry => ({
  issueKey, timeSpentSecs: secs, started, comment: "work", isRepeat,
});

const repeat = e("OPS-1", 1800, "2026-10-01T09:30:00", true);
const out = applyProjectSourceRules(
  [repeat, e("NM-12", 3600, "2026-10-01T10:00:00"), e("ABC-99", 3600, "2026-10-01T11:00:00"), e("NM-14", 3500, "2026-10-01T12:00:00")],
  transcript,
  [{ ticketId: "OPS-1" }]
);

const nonRepeat = out.filter((x) => !x.isRepeat);
assert.strictEqual(nonRepeat.reduce((s, x) => s + x.timeSpentSecs, 0), 3 * 3600, "3 × 1h stays 3h before the day-total floor");
assert.strictEqual(out.find((x) => x.started.endsWith("11:00:00"))!.issueKey, "", "invented ABC-99 is blanked");
assert.ok(out.some((x) => x.issueKey === "NM-12"), "key from a commit subject is kept");
assert.ok(out.some((x) => x.issueKey === "NM-14"), "key from refs is kept");
assert.deepStrictEqual(out.find((x) => x.isRepeat), repeat, "repeat entries untouched");
assert.deepStrictEqual(out.map((x) => x.started), [...out.map((x) => x.started)].sort(), "sorted by start");

// A key that only extends a real one ("NM-1" inside "NM-12") is not evidence.
assert.strictEqual(applyProjectSourceRules([e("NM-1", 1800, "2026-10-01T10:00:00")], transcript, [])[0].issueKey, "");
// Repeat ticket IDs count as evidence; tiny estimates round up to 30 min.
const r = applyProjectSourceRules([e("OPS-1", 600, "2026-10-01T10:00:00")], transcript, [{ ticketId: "OPS-1" }])[0];
assert.strictEqual(r.issueKey, "OPS-1");
assert.strictEqual(r.timeSpentSecs, 1800);

// What /api/parse does: the 8h floor still applies, keeping blanked keys.
const floored = enforceTimeRules(out, 8 * 3600);
assert.strictEqual(floored.reduce((s, x) => s + x.timeSpentSecs, 0), 8 * 3600, "commit day meets the 8h minimum");
assert.ok(floored.some((x) => x.issueKey === "" && !x.isRepeat), "blanked key survives the floor");
// A single ticket takes the whole day.
const one = enforceTimeRules(applyProjectSourceRules([e("NM-12", 1800, "2026-10-01T10:00:00")], transcript, []), 8 * 3600);
assert.strictEqual(one[0].timeSpentSecs, 8 * 3600, "one ticket gets all 8h");

console.log("project-rules: all assertions passed");
