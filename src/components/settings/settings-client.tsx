"use client";

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { PlatformConfigCard } from "./platform-config-card";
import { JiraConfigCard } from "./jira-config-card";
import { AIProviderCard } from "./ai-provider-card";
import { NotificationCard } from "./notification-card";
import { McpStatusCard } from "./mcp-status-card";
import { KeyboardShortcutsCard } from "./keyboard-shortcuts-card";
import {
  MessageSquare,
  Users,
  BookOpen,
  Sparkles,
  Workflow,
  Bell,
  Keyboard,
} from "lucide-react";
import type { PlatformConfigData } from "@/types";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  electronOnly?: boolean;
}

const navItems: NavItem[] = [
  { key: "slack", label: "Slack Portal", icon: MessageSquare },
  { key: "teams", label: "Teams Portal", icon: Users },
  { key: "jira", label: "Jira Chronicle", icon: BookOpen },
  { key: "ai", label: "Divine Oracle", icon: Sparkles },
  { key: "mcp", label: "Messenger Protocol", icon: Workflow },
  { key: "notifications", label: "Sacred Bell", icon: Bell, electronOnly: true },
  { key: "shortcuts", label: "Sacred Gestures", icon: Keyboard },
];

interface Props {
  initialConfigs: PlatformConfigData[];
}

export function SettingsClient({ initialConfigs }: Props) {
  const { configs, setConfigs, saveConfig } = useSettingsStore();
  const [activeSection, setActiveSection] = useState("slack");
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    setConfigs(initialConfigs);
  }, [initialConfigs, setConfigs]);

  useEffect(() => {
    setIsElectron(!!window.narada?.isElectron);
  }, []);

  const displayConfigs = configs.length > 0 ? configs : initialConfigs;

  const slackConfigs = displayConfigs.filter((c) => c.platform === "SLACK");
  const teamsConfigs = displayConfigs.filter((c) => c.platform === "TEAMS");
  const jiraConfigs = displayConfigs.filter((c) => c.platform === "JIRA");

  const visibleNavItems = navItems.filter(
    (item) => !item.electronOnly || isElectron
  );

  // Fall back to first visible section if active section is hidden
  const resolvedSection = visibleNavItems.some((item) => item.key === activeSection)
    ? activeSection
    : visibleNavItems[0]?.key ?? "slack";

  const renderActiveCard = () => {
    switch (resolvedSection) {
      case "slack":
        return slackConfigs.map((config) => (
          <PlatformConfigCard
            key={config.id}
            config={config}
            onSave={saveConfig}
            onToggle={saveConfig}
          />
        ));
      case "teams":
        return teamsConfigs.map((config) => (
          <PlatformConfigCard
            key={config.id}
            config={config}
            onSave={saveConfig}
            onToggle={saveConfig}
          />
        ));
      case "jira":
        return jiraConfigs.map((config) => (
          <JiraConfigCard
            key={config.id}
            config={config}
            onSave={saveConfig}
            onToggle={saveConfig}
          />
        ));
      case "ai":
        return <AIProviderCard />;
      case "mcp":
        return <McpStatusCard />;
      case "notifications":
        return <NotificationCard />;
      case "shortcuts":
        return <KeyboardShortcutsCard />;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <h1 className="text-[28px] font-bold text-narada-text mb-4 max-w-[860px] mx-auto">
        Sacred Configurations
      </h1>

      <div className="flex gap-5 max-w-[860px] mx-auto">
        {/* Left sidebar nav */}
        <nav className="w-[220px] shrink-0">
          <div className="sticky top-5 flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = resolvedSection === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveSection(item.key)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-white/[0.05] text-narada-text shadow-[inset_0_0_20px_rgba(59,130,246,0.15)]"
                      : "text-narada-text-secondary hover:text-narada-text hover:bg-white/[0.03]"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0 max-w-[600px]">
          <div className="flex flex-col gap-6">
            {renderActiveCard()}
          </div>
        </div>
      </div>
    </div>
  );
}
