// Time-entry rules for drafts built from commits (source "projects"). Unlike
// the manual path there is no 8h scaling: commits show work, not hours, so
// every estimate is flagged for the user to confirm, and a ticket key the
// evidence never mentions is blanked rather than trusted.

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
        ? { ...e, needsConfirmation: false }
        : {
            ...e,
            timeSpentSecs: Math.max(STEP_SECS, Math.round(e.timeSpentSecs / STEP_SECS) * STEP_SECS),
            issueKey: evidence.has(e.issueKey) ? e.issueKey : "",
            needsConfirmation: true,
          }
    )
    .sort((a, b) => a.started.localeCompare(b.started));
}
