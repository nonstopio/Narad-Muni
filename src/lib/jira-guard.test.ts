/**
 * Self-check for the Jira publish guard. Run: npx tsx src/lib/jira-guard.test.ts
 * The same rule disables Dispatch in the UI and returns 400 from the server,
 * so nothing half-publishes when a worklog cannot be posted.
 */

import assert from "node:assert";
import { jiraPublishBlocker, JIRA_BLOCKED, isValidIssueKey } from "./jira-guard";

const ok = { issueKey: "NM-12", timeSpentSecs: 3600, isRepeat: false };

assert.strictEqual(jiraPublishBlocker([ok]), null, "confirmed valid entry");
assert.strictEqual(jiraPublishBlocker([{ ...ok, needsConfirmation: false }]), null);
assert.strictEqual(jiraPublishBlocker([{ issueKey: "", timeSpentSecs: 1800, isRepeat: true }]), null, "repeat-only entries");
assert.strictEqual(jiraPublishBlocker([]), null);

assert.strictEqual(jiraPublishBlocker([{ ...ok, needsConfirmation: true }]), JIRA_BLOCKED, "unconfirmed estimate");
assert.strictEqual(jiraPublishBlocker([{ ...ok, issueKey: "" }]), JIRA_BLOCKED, "blank key");
assert.strictEqual(jiraPublishBlocker([{ ...ok, issueKey: "nm-12" }]), JIRA_BLOCKED, "lowercase key");
assert.strictEqual(jiraPublishBlocker([{ ...ok, issueKey: "NM-12 extra" }]), JIRA_BLOCKED, "not a full match");
assert.strictEqual(jiraPublishBlocker([{ ...ok, timeSpentSecs: 0 }]), JIRA_BLOCKED, "0 s");
assert.strictEqual(jiraPublishBlocker([ok, { ...ok, timeSpentSecs: -5 }]), JIRA_BLOCKED, "any bad entry blocks");

assert.ok(isValidIssueKey("ABC_2-1"));
assert.ok(!isValidIssueKey("A-1"), "project key needs 2+ chars");

console.log("jira-guard: all assertions passed");
