"use client";

import { useState } from "react";
import type { PlatformConfigData, RepeatEntryData } from "@/types";
import { useToastStore } from "@/components/ui/toast";

interface Props {
  config: PlatformConfigData;
  onSave: (config: PlatformConfigData) => Promise<{ success: boolean; error?: string }>;
  onToggle: (config: PlatformConfigData) => Promise<{ success: boolean; error?: string }>;
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

export function JiraConfigCard({ config, onSave, onToggle }: Props) {
  const [form, setForm] = useState(config);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const addToast = useToastStore((s) => s.addToast);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: false }));
  };

  const validate = (): string | null => {
    const newErrors: Record<string, boolean> = {};
    if (!form.baseUrl?.trim() || !/^https?:\/\/.+/.test(form.baseUrl.trim())) {
      newErrors.baseUrl = true;
    }
    if (!form.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = true;
    }
    if (!form.apiToken?.trim()) {
      newErrors.apiToken = true;
    }
    for (let i = 0; i < form.repeatEntries.length; i++) {
      const entry = form.repeatEntries[i];
      if (!entry.ticketId.trim()) newErrors[`repeat_${i}_ticketId`] = true;
      if (entry.hours <= 0) newErrors[`repeat_${i}_hours`] = true;
    }
    setErrors(newErrors);
    const keys = Object.keys(newErrors);
    if (keys.length === 0) return null;
    if (newErrors.baseUrl) return "Base URL is required and must be a valid URL";
    if (newErrors.email) return "A valid email is required";
    if (newErrors.apiToken) return "API token is required";
    if (keys.some((k) => k.startsWith("repeat_"))) return "Repeat entries need a ticket ID and hours > 0";
    return "Please fix the highlighted fields";
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
    const key = `repeat_${index}_${field}`;
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: false }));
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

  const handleToggle = async () => {
    const newActive = !form.isActive;
    setForm((prev) => ({ ...prev, isActive: newActive }));
    const result = await onToggle({ ...form, isActive: newActive });
    if (result.success) {
      addToast(`Jira ${newActive ? "enabled" : "disabled"}`, "success");
    } else {
      setForm((prev) => ({ ...prev, isActive: !newActive }));
      addToast(result.error ?? "Failed to toggle platform", "error");
    }
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      addToast(error, "error");
      return;
    }
    setSaving(true);
    try {
      const result = await onSave(form);
      if (result.success) {
        addToast("Jira settings saved", "success");
      } else {
        addToast(result.error ?? "Failed to save settings", "error");
      }
    } catch {
      addToast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="text-base font-semibold mb-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-base">
          {"\u{1F4CB}"}
        </div>
        <span>Jira Work Logs Configuration</span>
        <button
          onClick={handleToggle}
          className={`ml-auto relative w-10 h-[22px] rounded-full transition-colors duration-200 ${
            form.isActive ? "bg-narada-emerald" : "bg-white/[0.1]"
          }`}
          aria-label={`${form.isActive ? "Disable" : "Enable"} Jira`}
        >
          <span
            className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
              form.isActive ? "translate-x-[18px]" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className={`transition-opacity duration-200 ${!form.isActive ? "opacity-40 pointer-events-none" : ""}`}>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
              Base URL
            </label>
            <input
              className={`glass-input ${errors.baseUrl ? "!border-narada-rose" : ""}`}
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
              className={`glass-input ${errors.email ? "!border-narada-rose" : ""}`}
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
              className={`glass-input ${errors.apiToken ? "!border-narada-rose" : ""}`}
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
                  className={`p-1.5 bg-white/[0.03] border rounded text-narada-text font-mono text-[11px] ${errors[`repeat_${idx}_ticketId`] ? "border-narada-rose" : "border-white/[0.06]"}`}
                  value={entry.ticketId}
                  onChange={(e) =>
                    updateRepeatEntry(idx, "ticketId", e.target.value)
                  }
                  placeholder="OPP-123"
                />
                <input
                  className={`p-1.5 bg-white/[0.03] border rounded text-narada-text font-mono text-[11px] ${errors[`repeat_${idx}_hours`] ? "border-narada-rose" : "border-white/[0.06]"}`}
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
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-8 px-3 rounded-xl bg-narada-primary text-white text-xs font-semibold shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:bg-blue-600 transition-all duration-300 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
