// One rule for "can Jira receive these worklogs?", used by the Dispatch button
// and by POST/PUT /api/updates, so nothing half-publishes.

export const JIRA_BLOCKED = "Alas! Confirm every Jira duration and ticket before dispatching.";

export const isValidIssueKey = (key: string) => /^[A-Z][A-Z0-9_]+-\d+$/.test(key);

export function jiraPublishBlocker(
  entries: { issueKey: string; timeSpentSecs: number; isRepeat: boolean; needsConfirmation?: boolean }[]
): string | null {
  const blocked = entries.some(
    (e) => e.needsConfirmation === true || (!e.isRepeat && (!isValidIssueKey(e.issueKey) || !(e.timeSpentSecs > 0) || e.timeSpentSecs % 1800 !== 0))
  );
  return blocked ? JIRA_BLOCKED : null;
}
