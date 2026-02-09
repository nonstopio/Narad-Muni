"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { PlatformConfigCard } from "./platform-config-card";
import { JiraConfigCard } from "./jira-config-card";
import { AIProviderCard } from "./ai-provider-card";
import type { PlatformConfigData } from "@/types";

interface Props {
  initialConfigs: PlatformConfigData[];
}

export function SettingsClient({ initialConfigs }: Props) {
  const { configs, setConfigs, saveConfig } = useSettingsStore();

  useEffect(() => {
    setConfigs(initialConfigs);
  }, [initialConfigs, setConfigs]);

  const displayConfigs = configs.length > 0 ? configs : initialConfigs;

  const slackConfigs = displayConfigs.filter((c) => c.platform === "SLACK");
  const teamsConfigs = displayConfigs.filter((c) => c.platform === "TEAMS");
  const jiraConfigs = displayConfigs.filter((c) => c.platform === "JIRA");

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <h1 className="text-[28px] font-bold text-narada-text mb-6">Settings</h1>

      <div className="flex flex-col gap-6 max-w-[600px]">
        <AIProviderCard />

        {slackConfigs.map((config) => (
          <PlatformConfigCard
            key={config.id}
            config={config}
            onSave={saveConfig}
          />
        ))}

        {teamsConfigs.map((config) => (
          <PlatformConfigCard
            key={config.id}
            config={config}
            onSave={saveConfig}
          />
        ))}

        {jiraConfigs.map((config) => (
          <JiraConfigCard
            key={config.id}
            config={config}
            onSave={saveConfig}
          />
        ))}

        {/* Add Platform card */}
        <div className="bg-transparent border-2 border-dashed border-white/[0.06] rounded-2xl p-6 cursor-pointer hover:border-narada-primary hover:text-narada-text flex items-center justify-center gap-3 text-narada-text-secondary text-sm transition-all duration-300">
          <span>+ Add Platform</span>
        </div>
      </div>
    </div>
  );
}
