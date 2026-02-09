"use client";

import { useState } from "react";
import type { PlatformConfigData, RepeatEntryData } from "@/types";

interface Props {
  config: PlatformConfigData;
  onSave: (config: PlatformConfigData) => void;
}

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function JiraConfigCard({ config, onSave }: Props) {
  const [form, setForm] = useState(config);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateRepeatEntry = (
    index: number,
    field: keyof RepeatEntryData,
    value: string | number
  ) => {
    setForm((prev) => ({
      ...prev,
      repeatEntries: prev.repeatEntries.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry
      ),
    }));
  };

  const addRepeatEntry = () => {
    setForm((prev) => ({
      ...prev,
      repeatEntries: [
        ...prev.repeatEntries,
        { ticketId: "", hours: 1, startTime: "09:00", comment: "" },
      ],
    }));
  };

  const removeRepeatEntry = (index: number) => {
    setForm((prev) => ({
      ...prev,
      repeatEntries: prev.repeatEntries.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="glass-card p-6">
      <div className="text-base font-semibold mb-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-base">
          {"\u{1F4CB}"}
        </div>
        <span>Jira Work Logs Configuration</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
            Base URL
          </label>
          <input
            className="glass-input"
            type="text"
            placeholder="https://mycompany.atlassian.net"
            value={form.baseUrl || ""}
            onChange={(e) => update("baseUrl", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
            Project Key
          </label>
          <input
            className="glass-input"
            type="text"
            placeholder="PROJ"
            value={form.projectKey || ""}
            onChange={(e) => update("projectKey", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
            Email
          </label>
          <input
            className="glass-input"
            type="email"
            placeholder="your@email.com"
            value={form.email || ""}
            onChange={(e) => update("email", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
            API Token
          </label>
          <input
            className="glass-input"
            type="password"
            placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
            value={form.apiToken || ""}
            onChange={(e) => update("apiToken", e.target.value)}
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
          Timezone
        </label>
        <select
          className="glass-input bg-white/[0.02]"
          value={form.timezone || "UTC"}
          onChange={(e) => update("timezone", e.target.value)}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz} className="bg-narada-surface">
              {tz}
            </option>
          ))}
        </select>
      </div>

      {/* Repeat/Fixed Entries */}
      <div className="bg-emerald-500/[0.05] border border-emerald-500/20 rounded-xl p-4 mt-3">
        <div className="text-[13px] font-semibold text-narada-emerald mb-2">
          {"\u2699\uFE0F"} Repeat/Fixed Entries
        </div>
        <div className="text-xs text-narada-text-muted mb-3">
          Auto-added to every work log. For recurring meetings, standups, etc.
        </div>

        <div className="flex flex-col gap-2 mb-3">
          {form.repeatEntries.map((entry, idx) => (
            <div
              key={idx}
              className="grid gap-2 items-center p-2 bg-white/[0.02] rounded-lg font-mono text-xs"
              style={{ gridTemplateColumns: "80px 60px 80px 1fr 32px" }}
            >
              <input
                className="p-1.5 bg-white/[0.03] border border-white/[0.06] rounded text-narada-text font-mono text-[11px]"
                value={entry.ticketId}
                onChange={(e) =>
                  updateRepeatEntry(idx, "ticketId", e.target.value)
                }
                placeholder="OPP-123"
              />
              <input
                className="p-1.5 bg-white/[0.03] border border-white/[0.06] rounded text-narada-text font-mono text-[11px]"
                value={`${entry.hours}h`}
                onChange={(e) => {
                  const val = parseFloat(e.target.value.replace("h", "")) || 0;
                  updateRepeatEntry(idx, "hours", val);
                }}
              />
              <input
                className="p-1.5 bg-white/[0.03] border border-white/[0.06] rounded text-narada-text font-mono text-[11px]"
                value={entry.startTime}
                onChange={(e) =>
                  updateRepeatEntry(idx, "startTime", e.target.value)
                }
                placeholder="10:00"
              />
              <input
                className="p-1.5 bg-white/[0.03] border border-white/[0.06] rounded text-narada-text font-mono text-[11px]"
                value={entry.comment}
                onChange={(e) =>
                  updateRepeatEntry(idx, "comment", e.target.value)
                }
                placeholder="Description"
              />
              <button
                onClick={() => removeRepeatEntry(idx)}
                className="w-7 h-7 bg-rose-500/10 border border-rose-500/30 rounded text-narada-rose flex items-center justify-center hover:bg-rose-500/20 transition-all duration-300 text-xs"
              >
                {"\u2715"}
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addRepeatEntry}
          className="px-4 py-2 text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-narada-emerald hover:bg-emerald-500/20 transition-all duration-300"
        >
          + Add Repeat Entry
        </button>
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
