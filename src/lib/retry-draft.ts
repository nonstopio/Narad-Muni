import type { WorkLogEntryData } from "@/types";
/** Fresh server receipts always win over a stale local retry preview. */
export function restoreRetryEntries(server: WorkLogEntryData[], local: WorkLogEntryData[]): WorkLogEntryData[] {
  const posted = server.filter(entry => entry.jiraWorklogId);
  const known = new Set(server.map(entry => entry.id));
  return [...posted, ...local.filter(entry => !entry.jiraWorklogId && (!entry.id || known.has(entry.id)) && !posted.some(saved => saved.id === entry.id))];
}
