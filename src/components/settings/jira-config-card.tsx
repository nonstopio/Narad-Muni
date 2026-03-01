"use client";

import { useState } from "react";
import parse from "parse-duration";
import { authedFetch } from "@/lib/api-client";
import type { PlatformConfigData, RepeatEntryData } from "@/types";
import { useToastStore } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

function parseHoursInput(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  const ms = parse(trimmed);
  if (ms == null || ms <= 0) return null;

  // Snap to nearest 30-minute increment, minimum 30m
  const mins = ms / 60000;
  const snapped = Math.round(mins / 30) * 30;
  const clamped = Math.max(snapped, 30);
  return clamped / 60; // return as hours
}

function formatHours(hours: number): string {
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (m > 0) return `${h}h ${m}m`;
  return `${h}h`;
}

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
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [hoursDrafts, setHoursDrafts] = useState<Record<number, string>>({});
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
    if (newErrors.baseUrl) return "A valid Base URL is needed to reach the Jira realm";
    if (newErrors.email) return "A valid email is needed to identify the messenger";
    if (newErrors.apiToken) return "An API token is needed to pass through the gates";
    if (keys.some((k) => k.startsWith("repeat_"))) return "Each recurring ritual needs a ticket ID and hours greater than zero";
    return "Attend to the highlighted fields before proceeding";
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
      addToast(newActive ? "Narayan Narayan! Jira is now open to receive your chronicles" : "Jira has been silenced for now", "success");
    } else {
      setForm((prev) => ({ ...prev, isActive: !newActive }));
      addToast(result.error ?? "Alas! Could not change the portal's state", "error");
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    if (!form.baseUrl?.trim() || !form.email?.trim() || !form.apiToken?.trim() || !form.projectKey?.trim()) {
      setTestResult({ type: "error", message: "All fields are required: Base URL, Email, API Token, and Project Key" });
      return;
    }
    setTesting(true);
    try {
      const res = await authedFetch("/api/settings/test-jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: form.baseUrl,
          email: form.email,
          apiToken: form.apiToken,
          projectKey: form.projectKey,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ type: "success", message: data.message });
      } else {
        setTestResult({ type: "error", message: data.error });
      }
    } catch {
      setTestResult({ type: "error", message: "Alas! Could not reach the Jira realm" });
    } finally {
      setTesting(false);
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
        addToast("Narayan Narayan! Jira portal configured", "success");
      } else {
        addToast(result.error ?? "Alas! The settings would not take hold", "error");
      }
    } catch {
      addToast("Alas! The settings would not take hold", "error");
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
        <span>Jira Chronicle Portal</span>
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
            {"\u2699\uFE0F"} Recurring Rituals
          </div>
          <div className="text-xs text-narada-text-muted mb-3">
            These sacred rituals repeat in every day&apos;s chronicle. For standups, meetings, and other daily rites.
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
                  value={
                    hoursDrafts[idx] !== undefined
                      ? hoursDrafts[idx]
                      : formatHours(entry.hours)
                  }
                  onFocus={() =>
                    setHoursDrafts((prev) => ({
                      ...prev,
                      [idx]: formatHours(entry.hours),
                    }))
                  }
                  onChange={(e) =>
                    setHoursDrafts((prev) => ({
                      ...prev,
                      [idx]: e.target.value,
                    }))
                  }
                  onBlur={() => {
                    const draft = hoursDrafts[idx];
                    if (draft !== undefined) {
                      const parsed = parseHoursInput(draft);
                      if (parsed !== null) {
                        updateRepeatEntry(idx, "hours", parsed);
                      }
                    }
                    setHoursDrafts((prev) => {
                      const next = { ...prev };
                      delete next[idx];
                      return next;
                    });
                  }}
                  placeholder="1h 30m"
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
                <Button
                  variant="danger-soft"
                  size="icon-xs"
                  onClick={() => removeRepeatEntry(idx)}
                >
                  {"\u2715"}
                </Button>
              </div>
            ))}
          </div>

          <Button
            variant="success-soft"
            size="sm"
            onClick={addRepeatEntry}
          >
            + Add Ritual
          </Button>
        </div>

        <div className="mt-4 pt-4 border-t border-white/[0.06] mb-4">
          <Button
            variant="secondary"
            size="default"
            onClick={handleTest}
            disabled={saving || testing}
            className="w-full hover:border-narada-violet/50 hover:text-narada-text hover:bg-narada-violet/[0.05]"
          >
            {testing ? "Seeking the Jira realm..." : "Test Jira Connection"}
          </Button>
        </div>

        <div className="flex justify-end pt-4 border-t border-white/[0.06]">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving || testing}
          >
            {saving ? "Inscribing..." : "Inscribe"}
          </Button>
        </div>
      </div>

      {testResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setTestResult(null)} />
          <div className="relative glass-card p-6 max-w-sm w-full shadow-2xl border border-white/[0.08]">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                testResult.type === "success"
                  ? "bg-narada-emerald/10 text-narada-emerald"
                  : "bg-narada-rose/10 text-narada-rose"
              }`}>
                {testResult.type === "success" ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                )}
              </div>
              <h3 className="text-sm font-semibold text-narada-text">
                {testResult.type === "success" ? "Jira Realm Reached" : "Jira Realm Unreachable"}
              </h3>
            </div>
            <p className="text-xs text-narada-text-secondary leading-relaxed mb-4">
              {testResult.message}
            </p>
            <Button
              variant={testResult.type === "success" ? "success-soft" : "danger-soft"}
              size="sm"
              onClick={() => setTestResult(null)}
              className="w-full"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
