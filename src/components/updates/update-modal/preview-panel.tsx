"use client";

import { useState } from "react";
import { useUpdateStore } from "@/stores/update-store";
import { StepProcessing } from "./step-processing";
import { MessageSquare, Users, ClipboardList, Check, Send, Loader2 } from "lucide-react";

type TabType = "slack" | "teams" | "jira";

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: "slack", label: "Slack", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "teams", label: "Teams", icon: <Users className="w-4 h-4" /> },
  { id: "jira", label: "Jira Work Logs", icon: <ClipboardList className="w-4 h-4" /> },
];

interface PreviewPanelProps {
  onShareAll: () => void;
}

export function PreviewPanel({ onShareAll }: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("slack");
  const {
    previewReady,
    isProcessing,
    step,
    slackOutput,
    teamsOutput,
    workLogEntries,
    setSlackOutput,
    setTeamsOutput,
    slackEnabled,
    teamsEnabled,
    jiraEnabled,
    togglePlatform,
  } = useUpdateStore();

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (m > 0) return `${h}h ${m}m`;
    return `${h}h`;
  };

  const formatStartTime = (started: string) => {
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
  };

  const totalHours = workLogEntries.reduce((sum, e) => sum + e.timeSpentSecs, 0) / 3600;
  const isSharing = step === "sharing";

  // Empty state
  if (!previewReady && !isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
          <Loader2 className="w-7 h-7 text-narada-text-muted" />
        </div>
        <p className="text-sm text-narada-text-secondary mb-1">
          Process your update to see preview
        </p>
        <p className="text-xs text-narada-text-muted">
          Enter your daily update on the left and click &quot;Process with AI&quot;
        </p>
      </div>
    );
  }

  // Processing state — inline
  if (isProcessing && !previewReady) {
    return (
      <div className="flex items-center justify-center h-full">
        <StepProcessing compact />
      </div>
    );
  }

  // Ready state — tabbed preview
  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex gap-4 mb-4 border-b border-white/[0.06] pb-3 flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all duration-300 border-b-2 ${
              activeTab === tab.id
                ? "text-narada-primary border-narada-primary shadow-[0_2px_8px_rgba(59,130,246,0.3)]"
                : "text-narada-text-secondary border-transparent hover:text-narada-text"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === "slack" && (
          <div>
            <div className="text-xs font-semibold text-narada-text-secondary uppercase tracking-wider mb-2">
              Preview
            </div>
            <textarea
              className="glass-input min-h-[200px] font-mono text-[13px] text-narada-text-secondary resize-y"
              value={slackOutput}
              onChange={(e) => setSlackOutput(e.target.value)}
            />
          </div>
        )}

        {activeTab === "teams" && (
          <div>
            <div className="text-xs font-semibold text-narada-text-secondary uppercase tracking-wider mb-2">
              Preview
            </div>
            <textarea
              className="glass-input min-h-[200px] font-mono text-[13px] text-narada-text-secondary resize-y"
              value={teamsOutput}
              onChange={(e) => setTeamsOutput(e.target.value)}
            />
          </div>
        )}

        {activeTab === "jira" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-narada-text-secondary uppercase tracking-wider">
                Work Log Entries
              </span>
              <span className={`text-xs font-mono font-semibold ${totalHours >= 8 ? "text-narada-emerald" : "text-narada-amber"}`}>
                {totalHours.toFixed(1)}h total
              </span>
            </div>
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
          </div>
        )}
      </div>

      {/* Platform toggles + Share All */}
      <div className="mt-4 pt-4 border-t border-white/[0.06] flex-shrink-0">
        <div className="text-xs font-semibold text-narada-text-secondary uppercase tracking-wider mb-3">
          Publish to:
        </div>
        <div className="flex gap-2 flex-wrap mb-4">
          {(
            [
              { key: "slack" as const, label: "Slack", enabled: slackEnabled },
              { key: "teams" as const, label: "Teams", enabled: teamsEnabled },
              { key: "jira" as const, label: "Jira", enabled: jiraEnabled },
            ] as const
          ).map((platform) => (
            <button
              key={platform.key}
              onClick={() => togglePlatform(platform.key)}
              className={`px-3 py-1.5 rounded-3xl text-[12px] font-medium flex items-center gap-1.5 transition-all duration-300 ${
                platform.enabled
                  ? "bg-narada-primary border border-narada-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                  : "bg-white/[0.03] border border-white/[0.06] text-narada-text-secondary hover:bg-white/[0.06]"
              }`}
            >
              {platform.enabled && <Check className="w-3 h-3" />}
              <span>{platform.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onShareAll}
          disabled={isSharing}
          className="w-full h-10 rounded-xl bg-narada-emerald text-white font-semibold text-[13px] shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-600 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSharing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Sharing...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Share All</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
