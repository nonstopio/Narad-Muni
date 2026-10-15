import assert from "node:assert/strict";
import { restoreRetryEntries } from "./retry-draft";
const entry = { issueKey: "PROJ-1", timeSpentSecs: 1800, started: "2026-10-15T09:00:00", comment: "old", isRepeat: false };
const server = [{ ...entry, id: "first", jiraWorklogId: "receipt-42" }, { ...entry, id: "second", jiraWorklogId: null }];
const stale = server.map(e => ({ ...e, jiraWorklogId: null, comment: "local edit" }));
assert.deepEqual(restoreRetryEntries(server, stale), [server[0], stale[1]]);
assert.equal(restoreRetryEntries(server, [...stale, { ...entry, comment: "new row" }]).length, 3);
console.log("retry-draft: fresh server receipts survive stale local previews; new rows retained");
