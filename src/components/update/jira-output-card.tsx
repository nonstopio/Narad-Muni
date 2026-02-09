"use client";

import { useUpdateStore } from "@/stores/update-store";
import { ClipboardList, Check } from "lucide-react";

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (m > 0) return `${h}h ${m}m`;
  return `${h}h`;
}

function formatStartTime(started: string) {
  try {
    const d = new Date(started);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return started.split("T")[1]?.substring(0, 5) || started;
  }
}

export function JiraOutputCard() {
  const { workLogEntries, jiraEnabled, togglePlatform } = useUpdateStore();

  const totalHours =
    workLogEntries.reduce((sum, e) => sum + e.timeSpentSecs, 0) / 3600;

  return (
    <div
      className={`bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 backdrop-blur-[20px] transition-opacity duration-300 ${
        !jiraEnabled ? "opacity-50" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <ClipboardList className="w-4.5 h-4.5 text-narada-text-secondary" />
          <span className="text-sm font-semibold text-narada-text">
            Jira Work Logs
          </span>
          {workLogEntries.length > 0 && (
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
        <button
          onClick={() => togglePlatform("jira")}
          className={`px-3 py-1 rounded-3xl text-[11px] font-medium flex items-center gap-1.5 transition-all duration-300 ${
            jiraEnabled
              ? "bg-narada-primary border border-narada-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
              : "bg-white/[0.03] border border-white/[0.06] text-narada-text-secondary hover:bg-white/[0.06]"
          }`}
        >
          {jiraEnabled && <Check className="w-3 h-3" />}
          <span>{jiraEnabled ? "Enabled" : "Disabled"}</span>
        </button>
      </div>

      {/* Body — work log table */}
      {workLogEntries.length === 0 ? (
        <p className="text-xs text-narada-text-muted">
          Work log entries will appear here after processing...
        </p>
      ) : (
        <div className="overflow-x-auto">
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
              {workLogEntries.map((entry, idx) => (
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
      )}
    </div>
  );
}
