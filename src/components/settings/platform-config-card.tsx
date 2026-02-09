"use client";

import { useState } from "react";
import type { PlatformConfigData } from "@/types";

interface Props {
  config: PlatformConfigData;
  onSave: (config: PlatformConfigData) => void;
}

export function PlatformConfigCard({ config, onSave }: Props) {
  const [form, setForm] = useState(config);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const icon = config.platform === "SLACK" ? "\u{1F4AC}" : "\u{1F535}";
  const title =
    config.platform === "SLACK"
      ? "Slack Configuration"
      : "Microsoft Teams Configuration";
  const urlPlaceholder =
    config.platform === "SLACK"
      ? "https://hooks.slack.com/services/..."
      : "https://outlook.webhook.office.com/...";

  return (
    <div className="glass-card p-6">
      <div className="text-base font-semibold mb-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-base">
          {icon}
        </div>
        <span>{title}</span>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
          Webhook URL
        </label>
        <input
          className="glass-input font-mono text-[13px]"
          type="text"
          placeholder={urlPlaceholder}
          value={form.webhookUrl || ""}
          onChange={(e) => update("webhookUrl", e.target.value)}
        />
      </div>

      <div className="flex gap-3 mt-4 pt-4 border-t border-white/[0.06]">
        <button className="h-8 px-3 rounded-xl bg-white/[0.05] border border-white/[0.06] text-narada-text-secondary text-xs font-semibold hover:bg-white/[0.1] hover:text-narada-text transition-all duration-300">
          Test Connection
        </button>
        <button
          onClick={() => onSave(form)}
          className="h-8 px-3 rounded-xl bg-narada-primary text-white text-xs font-semibold shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:bg-blue-600 transition-all duration-300"
        >
          Save
        </button>
        <button className="h-8 px-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-narada-rose text-xs font-semibold hover:bg-rose-500/20 transition-all duration-300">
          Remove
        </button>
      </div>
    </div>
  );
}
