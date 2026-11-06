/**
 * Self-check: leave never counts toward home stats. Run: npx tsx src/lib/month-stats.test.ts
 * Stats take updates only; leave lives in its own collection and has no input here.
 */

import assert from "node:assert";
import { monthStats, loggedHoursByDate } from "./month-stats";

const u = (date: string, secs?: number) => ({ date, metrics: secs === undefined ? undefined : { estTimeSavedSecs: secs } });

// Mon, Tue, Thu updated; Wed on leave (not an update) → 3 messages.
const stats = monthStats([u("2026-09-28T00:00:00.000Z", 600), u("2026-09-29T00:00:00.000Z", 600), u("2026-10-01T00:00:00.000Z", 1800)]);
assert.strictEqual(stats.messages, 3);
assert.strictEqual(stats.timeReclaimed, "50m");

// Updates without metrics fall back to 12 minutes each.
assert.strictEqual(monthStats([u("2026-10-01T00:00:00.000Z"), u("2026-10-02T00:00:00.000Z", 3600)]).timeReclaimed, "1h 12m");
assert.deepStrictEqual(monthStats([]), { messages: 0, timeReclaimed: "0m" });

// Logged hours: confirmed worklogs only; legacy SENT updates count in full; skipped Jira counts nothing.
const w = (secs: number, id?: string) => ({ timeSpentSecs: secs, jiraWorklogId: id ?? null });
const hours = loggedHoursByDate([
  { date: "2026-10-05T00:00:00.000Z", jiraStatus: "SENT", workLogEntries: [w(3600, "1"), w(23400, "2")] },
  { date: "2026-10-06T00:00:00.000Z", jiraStatus: "FAILED", workLogEntries: [w(3600, "3"), w(7200)] },
  { date: "2026-10-07T00:00:00.000Z", jiraStatus: "SENT", workLogEntries: [w(1800), w(1800)] },
  { date: "2026-10-08T00:00:00.000Z", jiraStatus: "SKIPPED", workLogEntries: [w(28800)] },
  { date: "2026-10-09T00:00:00.000Z", jiraStatus: "FAILED", workLogEntries: [w(28800)] },
]);
assert.deepStrictEqual([...hours], [["2026-10-05", 7.5], ["2026-10-06", 1], ["2026-10-07", 1]]);

console.log("month-stats: all assertions passed");
