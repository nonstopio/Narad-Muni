"use client";

import { useUpdateStore } from "@/stores/update-store";
import { RefreshCw, Check, Minus } from "lucide-react";

function PlatformStatusBadge({
  platform,
  status,
}: {
  platform: string;
  status: "sent" | "retry" | "skipped";
}) {
  if (status === "sent") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 text-narada-emerald">
        <Check className="w-3 h-3" /> {platform} — Sent
      </span>
    );
  }
  if (status === "retry") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-narada-amber">
        <RefreshCw className="w-3 h-3" /> {platform} — Retry
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-white/[0.03] border border-white/[0.06] text-narada-text-muted">
      <Minus className="w-3 h-3" /> {platform} — Skipped
    </span>
  );
}

function getStatus(original: string | null, enabled: boolean): "sent" | "retry" | "skipped" {
  if (original === "SENT") return "sent";
  if (enabled && (original === "FAILED" || original === "PENDING")) return "retry";
  return "skipped";
}

export function RetryInputSection() {
  const {
    rawTranscript,
    retrySlackStatus,
    retryTeamsStatus,
    retryJiraStatus,
    slackEnabled,
    teamsEnabled,
    jiraEnabled,
  } = useUpdateStore();

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-narada-amber" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-narada-text">Retry Mode</h2>
          <p className="text-xs text-narada-text-muted">Re-dispatch failed scrolls</p>
        </div>
      </div>

      {/* Platform status badges */}
      <div className="flex flex-col gap-2">
        <PlatformStatusBadge platform="Slack" status={getStatus(retrySlackStatus, slackEnabled)} />
        <PlatformStatusBadge platform="Teams" status={getStatus(retryTeamsStatus, teamsEnabled)} />
        <PlatformStatusBadge platform="Jira" status={getStatus(retryJiraStatus, jiraEnabled)} />
      </div>

      {/* Read-only transcript */}
      <div className="flex-1 min-h-0">
        <h3 className="text-xs font-semibold text-narada-text-muted uppercase tracking-wider mb-2">
          Spoken Word
        </h3>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 max-h-[300px] overflow-y-auto">
          <p className="text-sm text-narada-text-secondary whitespace-pre-wrap">
            {rawTranscript || "No transcript recorded."}
          </p>
        </div>
      </div>

      {/* Helper text */}
      <p className="text-xs text-narada-text-muted">
        Edit the scrolls on the right, then dispatch to retry the failed worlds.
      </p>
    </div>
  );
}
