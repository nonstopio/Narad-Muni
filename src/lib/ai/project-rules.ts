// Time-entry rules for drafts built from commits (source "projects"). Commits
// show work, not hours, so estimates are rounded to half-hour steps, and a
// ticket key the evidence never mentions is blanked rather than trusted.
// The day-total floor (enforceTimeRules) runs after this, as for typed drafts.

import { findTickets } from "@/lib/linkify-tickets";
import type { ClaudeTimeEntry } from "@/types/claude";

const STEP_SECS = 1800; // 30-minute granularity and minimum

export function applyProjectSourceRules(
  entries: ClaudeTimeEntry[],
  transcript: string,
  repeats: { ticketId: string }[]
): ClaudeTimeEntry[] {
  const evidence = new Set([...findTickets(transcript), ...repeats.map((r) => r.ticketId)]);
  return entries
    .map((e) =>
      e.isRepeat
        ? e
        : {
            ...e,
            timeSpentSecs: Math.max(STEP_SECS, Math.round(e.timeSpentSecs / STEP_SECS) * STEP_SECS),
            issueKey: evidence.has(e.issueKey) ? e.issueKey : "",
          }
    )
    .sort((a, b) => a.started.localeCompare(b.started));
}
