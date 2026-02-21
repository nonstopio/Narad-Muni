"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { PlatformConfigCard } from "./platform-config-card";
import { JiraConfigCard } from "./jira-config-card";
import { AIProviderCard } from "./ai-provider-card";
import { DatabaseConfigCard } from "./database-config-card";
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
      <div className="max-w-[600px] mx-auto">
      <h1 className="text-[28px] font-bold text-narada-text mb-6">Sacred Configurations</h1>

      <div className="flex flex-col gap-6">
        {slackConfigs.map((config) => (
          <PlatformConfigCard
            key={config.id}
            config={config}
            onSave={saveConfig}
            onToggle={saveConfig}
          />
        ))}

        {teamsConfigs.map((config) => (
          <PlatformConfigCard
            key={config.id}
            config={config}
            onSave={saveConfig}
            onToggle={saveConfig}
          />
        ))}

        {jiraConfigs.map((config) => (
          <JiraConfigCard
            key={config.id}
            config={config}
            onSave={saveConfig}
            onToggle={saveConfig}
          />
        ))}

        <DatabaseConfigCard />
        <AIProviderCard />
      </div>
      </div>
    </div>
  );
}
