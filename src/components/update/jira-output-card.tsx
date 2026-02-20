"use client";

import { useState } from "react";
import parse from "parse-duration";
import { useUpdateStore } from "@/stores/update-store";
import { useAppStore } from "@/stores/app-store";
import { ClipboardList, Check, Plus, X } from "lucide-react";
import type { WorkLogEntryData } from "@/types";

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (m > 0) return `${h}h ${m}m`;
  return `${h}h`;
}

function formatStartTime(started: string) {
  const m = started.match(/T(\d{2}):(\d{2})/);
  if (m) return `${m[1]}:${m[2]}`;
  return started;
}

function parseTimeInput(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  const ms = parse(trimmed);
  if (ms == null || ms <= 0) return null;

  // Snap to nearest 30-minute increment, minimum 30m
  const mins = ms / 60000;
  const snapped = Math.round(mins / 30) * 30;
  const clamped = Math.max(snapped, 30);
  return clamped * 60; // convert minutes to seconds
}

function patchStartTime(originalStarted: string, newTime: string): string {
  // Replace HH:MM in the ISO string, keeping the date portion
  const datePrefix = originalStarted.slice(0, 11); // "YYYY-MM-DDT"
  const suffix = originalStarted.slice(16); // everything after HH:MM
  return `${datePrefix}${newTime}${suffix}`;
}

function buildDefaultEntry(dateStr: string): WorkLogEntryData {
  return {
    issueKey: "",
    timeSpentSecs: 1800, // 30m
    started: `${dateStr}T09:00:00.000+0000`,
    comment: "",
    isRepeat: false,
  };
}

export function JiraOutputCard() {
  const {
    workLogEntries,
    jiraEnabled,
    togglePlatform,
    updateWorkLogEntry,
    addWorkLogEntry,
    removeWorkLogEntry,
  } = useUpdateStore();
  const selectedDate = useAppStore((s) => s.selectedDate);

  const [timeDrafts, setTimeDrafts] = useState<Record<number, string>>({});

  const totalHours =
    workLogEntries.reduce((sum, e) => sum + e.timeSpentSecs, 0) / 3600;

  const handleAddEntry = () => {
    const dateStr = selectedDate
      ? selectedDate.toLocaleDateString("sv-SE")
      : new Date().toLocaleDateString("sv-SE");
    addWorkLogEntry(buildDefaultEntry(dateStr));
  };

  const handleRemoveEntry = (idx: number) => {
    removeWorkLogEntry(idx);
    setTimeDrafts((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

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
          <span>{jiraEnabled ? "Open" : "Sealed"}</span>
        </button>
      </div>

      {/* Body — work log table */}
      {workLogEntries.length === 0 ? (
        <p className="text-xs text-narada-text-muted">
          The work chronicles will appear once the sage has spoken...
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
                <th className="bg-white/[0.03] p-2 w-8 border-b border-white/[0.06]" />
              </tr>
            </thead>
            <tbody>
              {workLogEntries.map((entry, idx) => (
                <tr
                  key={idx}
                  className={
                    entry.isRepeat ? "border-l-2 border-l-violet-500" : ""
                  }
                >
                  <td className="p-1.5 border-b border-white/[0.06]">
                    <input
                      type="text"
                      value={entry.issueKey}
                      onChange={(e) =>
                        updateWorkLogEntry(idx, {
                          issueKey: e.target.value.toUpperCase(),
                        })
                      }
                      className="glass-input w-full px-2 py-1 text-xs font-mono text-narada-text-secondary bg-transparent"
                      placeholder="PROJ-123"
                    />
                  </td>
                  <td className="p-1.5 border-b border-white/[0.06]">
                    <input
                      type="text"
                      value={
                        timeDrafts[idx] !== undefined
                          ? timeDrafts[idx]
                          : formatTime(entry.timeSpentSecs)
                      }
                      onFocus={() =>
                        setTimeDrafts((prev) => ({
                          ...prev,
                          [idx]: formatTime(entry.timeSpentSecs),
                        }))
                      }
                      onChange={(e) =>
                        setTimeDrafts((prev) => ({
                          ...prev,
                          [idx]: e.target.value,
                        }))
                      }
                      onBlur={() => {
                        const draft = timeDrafts[idx];
                        if (draft !== undefined) {
                          const parsed = parseTimeInput(draft);
                          if (parsed !== null) {
                            updateWorkLogEntry(idx, {
                              timeSpentSecs: parsed,
                            });
                          }
                        }
                        setTimeDrafts((prev) => {
                          const next = { ...prev };
                          delete next[idx];
                          return next;
                        });
                      }}
                      className="glass-input w-24 px-2 py-1 text-xs text-narada-text-secondary bg-transparent"
                      placeholder="1h 30m"
                    />
                  </td>
                  <td className="p-1.5 border-b border-white/[0.06]">
                    <input
                      type="time"
                      value={formatStartTime(entry.started)}
                      onChange={(e) =>
                        updateWorkLogEntry(idx, {
                          started: patchStartTime(
                            entry.started,
                            e.target.value
                          ),
                        })
                      }
                      className="glass-input px-2 py-1 text-xs text-narada-text-secondary bg-transparent"
                    />
                  </td>
                  <td className="p-1.5 border-b border-white/[0.06]">
                    <input
                      type="text"
                      value={entry.comment ?? ""}
                      onChange={(e) =>
                        updateWorkLogEntry(idx, { comment: e.target.value })
                      }
                      className="glass-input w-full px-2 py-1 text-xs text-narada-text-secondary bg-transparent"
                      placeholder="What was done..."
                    />
                  </td>
                  <td className="p-1.5 border-b border-white/[0.06] text-center">
                    <button
                      onClick={() => handleRemoveEntry(idx)}
                      className="text-narada-text-muted hover:text-rose-400 transition-colors p-0.5"
                      title="Remove entry"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Entry button */}
      {jiraEnabled && (
        <button
          onClick={handleAddEntry}
          className="mt-3 flex items-center gap-1.5 text-xs text-narada-text-muted hover:text-narada-text-secondary transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Entry</span>
        </button>
      )}
    </div>
  );
}
