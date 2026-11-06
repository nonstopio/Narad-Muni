// Home stats for a month. Built from updates alone, so leave days (stored
// separately) can never count as a message or as time saved.

// Fallback used for updates missing `metrics` (i.e. published before analytics v2).
const FALLBACK_TIME_SAVED_SECS = 12 * 60;

function formatTimeReclaimed(totalSecs: number): string {
  const totalMins = Math.round(totalSecs / 60);
  if (totalMins < 60) return `${totalMins}m`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

export function monthStats(updates: { metrics?: { estTimeSavedSecs?: number } }[]) {
  const totalSecs = updates.reduce((sum, u) => {
    const v = u.metrics?.estTimeSavedSecs;
    return sum + (typeof v === "number" ? v : FALLBACK_TIME_SAVED_SECS);
  }, 0);
  return { messages: updates.length, timeReclaimed: formatTimeReclaimed(totalSecs) };
}

interface LoggableUpdate {
  date: string;
  jiraStatus?: string;
  workLogEntries?: { timeSpentSecs: number; jiraWorklogId?: string | null }[];
}

/**
 * Seconds actually logged to Jira for one update: entries with a Jira worklog ID are
 * confirmed; older updates without IDs count in full once Jira reported success.
 */
export function loggedSecs(u: LoggableUpdate): number {
  const entries = u.workLogEntries ?? [];
  const confirmed = entries.filter((e) => e.jiraWorklogId);
  const counted = confirmed.length > 0 ? confirmed : u.jiraStatus === "SENT" ? entries : [];
  return counted.reduce((s, e) => s + (e.timeSpentSecs || 0), 0);
}

/** "YYYY-MM-DD" → hours logged that day; days with nothing logged are left out. */
export function loggedHoursByDate(updates: LoggableUpdate[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const u of updates) {
    const secs = loggedSecs(u);
    if (secs > 0) map.set(u.date.split("T")[0], secs / 3600);
  }
  return map;
}
