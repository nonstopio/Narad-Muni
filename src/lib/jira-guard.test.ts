/**
 * Self-check for the Jira publish guard. Run: npx tsx src/lib/jira-guard.test.ts
 * The same rule disables Dispatch in the UI and returns 400 from the server,
 * so nothing half-publishes when a worklog cannot be posted.
 */

import assert from "node:assert";
import { jiraPublishBlocker, JIRA_BLOCKED, isValidIssueKey, isQuickPick, toggleHalfHour, QUICK_HOURS } from "./jira-guard";

const ok = { issueKey: "NM-12", timeSpentSecs: 3600, isRepeat: false };

assert.strictEqual(jiraPublishBlocker([ok]), null, "valid entry");
assert.strictEqual(jiraPublishBlocker([{ issueKey: "", timeSpentSecs: 1800, isRepeat: true }]), null, "repeat-only entries");
assert.strictEqual(jiraPublishBlocker([]), null);

assert.strictEqual(jiraPublishBlocker([{ ...ok, issueKey: "" }]), JIRA_BLOCKED, "blank key");
assert.strictEqual(jiraPublishBlocker([{ ...ok, issueKey: "nm-12" }]), JIRA_BLOCKED, "lowercase key");
assert.strictEqual(jiraPublishBlocker([{ ...ok, issueKey: "NM-12 extra" }]), JIRA_BLOCKED, "not a full match");
assert.strictEqual(jiraPublishBlocker([{ ...ok, timeSpentSecs: 0 }]), JIRA_BLOCKED, "0 s");
assert.strictEqual(jiraPublishBlocker([ok, { ...ok, timeSpentSecs: -5 }]), JIRA_BLOCKED, "any bad entry blocks");
assert.strictEqual(jiraPublishBlocker([{ ...ok, timeSpentSecs: 4500 }]), JIRA_BLOCKED, "1h 15m is not a half-hour step");

assert.ok(isValidIssueKey("ABC_2-1"));
assert.ok(!isValidIssueKey("A-1"), "project key needs 2+ chars");

// Quick time picker: every chip and every toggle result passes the guard.
for (const h of QUICK_HOURS) {
  assert.strictEqual(jiraPublishBlocker([{ ...ok, timeSpentSecs: h * 3600 }]), null, `${h}h chip is publishable`);
  assert.ok(isQuickPick(h, h * 3600), `${h}h chip lights for its own value`);
}
assert.ok(isQuickPick(4, 4.5 * 3600), "4h 30m lights the 4h chip");
assert.ok(!isQuickPick(0.5, 3600) && !isQuickPick(1, 1800), "30m and 1h stay distinct");
assert.ok(!isQuickPick(8, 10 * 3600), "no chip for 10h");

assert.strictEqual(toggleHalfHour(4 * 3600), 4.5 * 3600, "+30m adds a half hour");
assert.strictEqual(toggleHalfHour(4.5 * 3600), 4 * 3600, "+30m again removes it");
assert.strictEqual(toggleHalfHour(1800), 3600, "30m + 30m = 1h");
assert.strictEqual(toggleHalfHour(0), 3600, "never below 30m");
assert.strictEqual(toggleHalfHour(4500), 3600, "off-step 1h15m snaps to 1h30m, then drops to 1h");
for (const s of [0, 900, 1800, 4500, 3600, 5400, 36000]) {
  assert.strictEqual(toggleHalfHour(s) % 1800, 0, `toggle of ${s}s stays on half-hour steps`);
}

console.log("jira-guard: all assertions passed");
