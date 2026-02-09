"use client";

import { useState } from "react";
import { useUpdateStore } from "@/stores/update-store";
import { MessageSquare, Users, ClipboardList, Check } from "lucide-react";

type TabType = "slack" | "teams" | "jira";

const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: "slack", label: "Slack", icon: <MessageSquare className="w-4 h-4" /> },
  { id: "teams", label: "Teams", icon: <Users className="w-4 h-4" /> },
  { id: "jira", label: "Jira Work Logs", icon: <ClipboardList className="w-4 h-4" /> },
];

export function StepPreview() {
  const [activeTab, setActiveTab] = useState<TabType>("slack");
  const {
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

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-4 mb-6 border-b border-white/[0.06] pb-3">
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

      {/* Tab content */}
      {activeTab === "slack" && (
        <div>
          <div className="text-xs font-semibold text-narada-text-secondary uppercase tracking-wider mb-2">
            Preview
          </div>
          <textarea
            className="glass-input min-h-[150px] font-mono text-[13px] text-narada-text-secondary resize-y"
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
            className="glass-input min-h-[150px] font-mono text-[13px] text-narada-text-secondary resize-y"
            value={teamsOutput}
            onChange={(e) => setTeamsOutput(e.target.value)}
          />
        </div>
      )}

      {activeTab === "jira" && (
        <div>
          <div className="text-xs font-semibold text-narada-text-secondary uppercase tracking-wider mb-2">
            Work Log Entry
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="bg-white/[0.03] p-2 text-left font-semibold text-narada-text-secondary border-b border-white/[0.06]">
                    Ticket
                  </th>
                  <th className="bg-white/[0.03] p-2 text-left font-semibold text-narada-text-secondary border-b border-white/[0.06]">
                    Time Spent
                  </th>
                  <th className="bg-white/[0.03] p-2 text-left font-semibold text-narada-text-secondary border-b border-white/[0.06]">
                    Start Time
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

      {/* Platform toggles */}
      <div className="mt-6">
        <div className="text-xs font-semibold text-narada-text-secondary uppercase tracking-wider mb-3">
          Publish to:
        </div>
        <div className="flex gap-3 flex-wrap">
          {(
            [
              { key: "slack" as const, label: "Slack", enabled: slackEnabled },
              { key: "teams" as const, label: "Teams", enabled: teamsEnabled },
              {
                key: "jira" as const,
                label: "Jira Work Logs",
                enabled: jiraEnabled,
              },
            ] as const
          ).map((platform) => (
            <button
              key={platform.key}
              onClick={() => togglePlatform(platform.key)}
              className={`px-4 py-2 rounded-3xl text-[13px] font-medium flex items-center gap-2 transition-all duration-300 ${
                platform.enabled
                  ? "bg-narada-primary border border-narada-primary text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                  : "bg-white/[0.03] border border-white/[0.06] text-narada-text-secondary hover:bg-white/[0.06]"
              }`}
            >
              {platform.enabled && <Check className="w-3.5 h-3.5" />}
              <span>{platform.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
