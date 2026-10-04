"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectCollectResult, ProjectSkipReason } from "@/types";

export const SKIP_TEXT: Record<ProjectSkipReason, string> = {
  "missing-folder": "folder is gone",
  "not-a-repo": "no longer a git repository",
  unreadable: "could not be read",
  "timed-out": "took too long",
  "too-large": "history too large",
  "no-author-email": "needs a commit email",
};

type Found = Extract<ProjectCollectResult, { ok: true }>;

interface Props {
  result: Found;
  hasDraft: boolean;
  onCancel: () => void;
  onInsert?: (mode: "replace" | "append") => void;
}

export function ProjectFetchDialog({ result, hasDraft, onCancel, onInsert }: Props) {
  useEffect(() => {
    document.addEventListener("narada:escape", onCancel);
    return () => document.removeEventListener("narada:escape", onCancel);
  }, [onCancel]);

  const dayTitle = new Date(`${result.date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const hhmm = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: result.timeZone,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" />

      <div
        className="relative w-full max-w-[720px] max-h-[80vh] flex flex-col bg-narada-surface border border-white/[0.06] rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Deeds from your repositories"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06] shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-narada-text">Deeds from your repositories</h2>
            <p className="text-xs text-narada-text-muted mt-0.5">
              {dayTitle} · {result.timeZone}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onCancel} aria-label="Close">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {result.projects
            .filter((p) => p.commits.length > 0)
            .map((p) => (
              <div key={p.id}>
                <h3 className="text-xs font-semibold text-narada-text-secondary uppercase tracking-wider mb-2">{p.name}</h3>
                <ul className="space-y-1">
                  {p.commits.map((c) => (
                    <li key={c.hash} className="flex items-baseline gap-3 text-sm">
                      <span className="font-mono text-xs text-narada-text-muted shrink-0">{hhmm.format(c.authorEpochMs)}</span>
                      <span className="text-narada-text flex-1 min-w-0 truncate" title={c.subject}>{c.subject}</span>
                      <span className="font-mono text-xs text-narada-text-muted shrink-0">{c.shortHash}</span>
                    </li>
                  ))}
                </ul>
                {p.truncated && (
                  <p className="mt-2 text-xs text-narada-amber">Showing the newest 50 — more deeds exist for this day.</p>
                )}
              </div>
            ))}

          {result.skipped.length > 0 && (
            <ul className="pt-3 border-t border-white/[0.06] space-y-0.5">
              {result.skipped.map((s) => (
                <li key={s.id} className="text-xs text-narada-text-muted">
                  Skipped: {s.name} — {SKIP_TEXT[s.reason]}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-white/[0.06] shrink-0">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          {onInsert && hasDraft && (
            <>
              <Button variant="danger-soft" onClick={() => onInsert("replace")}>
                Replace
              </Button>
              <Button variant="primary" onClick={() => onInsert("append")}>
                Append
              </Button>
            </>
          )}
          {onInsert && !hasDraft && (
            <Button variant="primary" onClick={() => onInsert("replace")}>
              Use in update
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
