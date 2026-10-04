// The commit activity block inserted into "Your Words". It carries only the
// project name, local time, subject, short hash and ticket IDs: no paths,
// emails or commit bodies reach the draft or the AI.

import { findTickets } from "./linkify-tickets";
import type { ProjectCollectResult } from "@/types";

type Found = Extract<ProjectCollectResult, { ok: true }>;

const CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;
const clean = (s: string) => s.replace(CONTROL, "").trim();

export function buildActivityBlock(result: Found): string {
  const hhmm = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: result.timeZone });
  const lines = [`[Project activity · ${result.date} · ${result.timeZone}]`];
  for (const p of result.projects) {
    if (p.commits.length === 0) continue;
    lines.push(clean(p.name));
    for (const c of [...p.commits].sort((a, b) => a.authorEpochMs - b.authorEpochMs)) {
      const subject = clean(c.subject);
      const refs = findTickets(`${c.subject}\n${c.body}`).filter((t) => !findTickets(subject).includes(t));
      lines.push(`- ${hhmm.format(c.authorEpochMs)} ${subject} (${c.shortHash})${refs.length ? ` · refs ${refs.join(", ")}` : ""}`);
    }
  }
  lines.push("[/Project activity]");
  return lines.join("\n");
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Put `block` into the draft. Append swaps an existing block for the same date
 * in place (refreshed) instead of stacking a second copy.
 */
export function insertActivity(draft: string, block: string, mode: "replace" | "append"): { text: string; refreshed: boolean } {
  if (mode === "replace") return { text: block, refreshed: false };
  const date = /^\[Project activity · (\d{4}-\d{2}-\d{2}) · /.exec(block)?.[1];
  if (date) {
    const existing = new RegExp(`\\[Project activity · ${escape(date)} · [^\\]\\n]*\\][\\s\\S]*?\\[/Project activity\\]`);
    if (existing.test(draft)) return { text: draft.replace(existing, () => block), refreshed: true };
  }
  const head = draft.trimEnd();
  return { text: head ? `${head}\n\n${block}` : block, refreshed: false };
}
