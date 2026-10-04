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
