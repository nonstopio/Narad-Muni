// One rule for "can Jira receive these worklogs?", used by the Dispatch button
// and by POST/PUT /api/updates, so nothing half-publishes.

export const JIRA_BLOCKED = "Alas! Each Jira scroll needs a valid ticket and a duration in half-hour steps.";

export const isValidIssueKey = (key: string) => /^[A-Z][A-Z0-9_]+-\d+$/.test(key);

export function jiraPublishBlocker(
  entries: { issueKey: string; timeSpentSecs: number; isRepeat: boolean }[]
): string | null {
  const blocked = entries.some(
    (e) => !e.isRepeat && (!isValidIssueKey(e.issueKey) || !(e.timeSpentSecs > 0) || e.timeSpentSecs % 1800 !== 0)
  );
  return blocked ? JIRA_BLOCKED : null;
}

// Quick durations offered under a worklog's Time field; 0.5 is the "30m" chip.
export const QUICK_HOURS = [0.5, 1, 2, 3, 4, 5, 6, 7, 8];

export const hasHalfHour = (secs: number) => secs > 1800 && secs % 3600 === 1800;

// The chip that matches a duration: whole hours ignore a trailing half hour,
// which the +30m toggle shows instead.
export const isQuickPick = (hours: number, secs: number) =>
  hours === 0.5 ? secs === 1800 : secs >= 3600 && Math.floor(secs / 3600) === hours;

// +30m toggle: add a half hour, or take it off again (never below 30m).
// Off-step durations snap to half hours first so the result is always valid.
export function toggleHalfHour(secs: number): number {
  const snapped = Math.max(1800, Math.round(secs / 1800) * 1800);
  return hasHalfHour(snapped) ? snapped - 1800 : snapped + 1800;
}
