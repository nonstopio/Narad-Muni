"use client";

import { useState, useEffect } from "react";
import { X, ClipboardList, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UpdateData } from "@/types";

function StatusBadge({
  platform,
  status,
}: {
  platform: string;
  status: string;
}) {
  const isSuccess = status === "SENT";
  const isFailed = status === "FAILED";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium ${
        isSuccess
          ? "bg-emerald-500/10 border border-emerald-500/30 text-narada-emerald"
          : isFailed
            ? "bg-rose-500/10 border border-rose-500/30 text-narada-rose"
            : "bg-white/[0.03] border border-white/[0.06] text-narada-text-muted"
      }`}
    >
      {isSuccess ? "\u2713" : isFailed ? "\u2717" : "\u2022"} {platform}
    </span>
  );
}

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (m > 0) return `${h}h ${m}m`;
  return `${h}h`;
}

function formatStartTime(started: string) {
  try {
    const d = new Date(started);
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return started.split("T")[1]?.substring(0, 5) || started;
  }
}

interface Props {
  update: UpdateData;
  onClose: () => void;
  onDelete: (id: string) => void;
  onRetry?: (update: UpdateData) => void;
}

export function HistoryDetailModal({ update, onClose, onDelete, onRetry }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    function handleEscape() {
      onClose();
    }
    document.addEventListener("narada:escape", handleEscape);
    return () => document.removeEventListener("narada:escape", handleEscape);
  }, [onClose]);

  const dateStr = new Date(update.date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const showSlack = update.slackStatus !== "SKIPPED";
  const showTeams = update.teamsStatus !== "SKIPPED";
  const showJira = update.jiraStatus !== "SKIPPED";

  const totalHours =
    update.workLogEntries.reduce((sum, e) => sum + e.timeSpentSecs, 0) / 3600;

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/updates?id=${update.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onDelete(update.id);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" />

      {/* Modal card */}
      <div
        className="relative w-full max-w-[800px] max-h-[80vh] flex flex-col bg-narada-surface border border-white/[0.06] rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06] shrink-0">
          <h2 className="text-lg font-semibold text-narada-text">{dateStr}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Raw Transcript */}
          <div>
            <h3 className="text-xs font-semibold text-narada-text-muted uppercase tracking-wider mb-2">
              Spoken Word
            </h3>
            <p className="text-sm text-narada-text-secondary whitespace-pre-wrap">
              {update.rawTranscript}
            </p>
          </div>

          {/* Slack */}
          {showSlack && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-semibold text-narada-text-muted uppercase tracking-wider">
                  Slack
                </h3>
                <StatusBadge platform="Slack" status={update.slackStatus} />
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <pre className="text-sm text-narada-text-secondary whitespace-pre-wrap font-sans">
                  {update.slackOutput}
                </pre>
              </div>
            </div>
          )}

          {/* Teams */}
          {showTeams && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xs font-semibold text-narada-text-muted uppercase tracking-wider">
                  Teams
                </h3>
                <StatusBadge platform="Teams" status={update.teamsStatus} />
              </div>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                <pre className="text-sm text-narada-text-secondary whitespace-pre-wrap font-sans">
                  {update.teamsOutput}
                </pre>
              </div>
            </div>
          )}

          {/* Jira */}
          {showJira && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-narada-text-secondary" />
                  <h3 className="text-xs font-semibold text-narada-text-muted uppercase tracking-wider">
                    Jira Work Logs
                  </h3>
                </div>
                <StatusBadge platform="Jira" status={update.jiraStatus} />
                {update.workLogEntries.length > 0 && (
                  <span
                    className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full ${
                      totalHours >= 8
                        ? "bg-emerald-500/10 text-narada-emerald"
                        : "bg-amber-500/10 text-narada-amber"
                    }`}
                  >
                    {totalHours.toFixed(1)}h
                  </span>
                )}
              </div>
              {update.workLogEntries.length > 0 ? (
                <div className="overflow-x-auto bg-white/[0.03] border border-white/[0.06] rounded-xl">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="bg-white/[0.03] p-2 text-left font-semibold text-narada-text-secondary border-b border-white/[0.06]">
                          Ticket
                        </th>
                        <th className="bg-white/[0.03] p-2 text-left font-semibold text-narada-text-secondary border-b border-white/[0.06]">
                          Time
                        </th>
                        <th className="bg-white/[0.03] p-2 text-left font-semibold text-narada-text-secondary border-b border-white/[0.06]">
                          Start
                        </th>
                        <th className="bg-white/[0.03] p-2 text-left font-semibold text-narada-text-secondary border-b border-white/[0.06]">
                          Comment
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {update.workLogEntries.map((entry, idx) => (
                        <tr key={idx}>
                          <td className="p-2 border-b border-white/[0.06] text-narada-text-secondary font-mono">
                            {entry.issueKey}
                          </td>
                          <td className="p-2 border-b border-white/[0.06] text-narada-text-secondary">
                            {formatTime(entry.timeSpentSecs)}
                          </td>
                          <td className="p-2 border-b border-white/[0.06] text-narada-text-secondary">
                            {formatStartTime(entry.started)}
                          </td>
                          <td className="p-2 border-b border-white/[0.06] text-narada-text-secondary">
                            {entry.comment}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-narada-text-muted">
                  No work has been chronicled for this day.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-white/[0.06] shrink-0">
          <Button
            variant={confirmDelete ? "danger" : "danger-soft"}
            size="default"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting
              ? "Erasing..."
              : confirmDelete
                ? "Truly erase this scroll?"
                : "Erase"}
          </Button>
          {onRetry &&
            (update.slackStatus === "FAILED" ||
              update.teamsStatus === "FAILED" ||
              update.jiraStatus === "FAILED") && (
              <Button
                variant="warning-soft"
                size="default"
                onClick={() => onRetry(update)}
              >
                <RefreshCw className="w-4 h-4" />
                Retry Failed Scrolls
              </Button>
            )}
        </div>
      </div>
    </div>
  );
}
