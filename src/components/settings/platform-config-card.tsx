"use client";

import { useState } from "react";
import type { PlatformConfigData } from "@/types";
import { useToastStore } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

interface Props {
  config: PlatformConfigData;
  onSave: (config: PlatformConfigData) => Promise<{ success: boolean; error?: string }>;
  onToggle: (config: PlatformConfigData) => Promise<{ success: boolean; error?: string }>;
}

export function PlatformConfigCard({ config, onSave, onToggle }: Props) {
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
    const url = form.webhookUrl?.trim();
    if (!url) {
      newErrors.webhookUrl = true;
    } else if (!/^https?:\/\/.+/.test(url)) {
      newErrors.webhookUrl = true;
    }
    setErrors(newErrors);
    if (newErrors.webhookUrl) return "A valid Webhook URL is needed to open this portal";
    return null;
  };

  const handleToggle = async () => {
    const newActive = !form.isActive;
    setForm((prev) => ({ ...prev, isActive: newActive }));
    const result = await onToggle({ ...form, isActive: newActive });
    if (result.success) {
      addToast(
        newActive
          ? `Narayan Narayan! ${isSlack ? "Slack" : "Teams"} is now open to receive your word`
          : `${isSlack ? "Slack" : "Teams"} has been silenced for now`,
        "success"
      );
    } else {
      setForm((prev) => ({ ...prev, isActive: !newActive }));
      addToast(result.error ?? "Alas! Could not change the portal's state", "error");
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
        addToast(`Narayan Narayan! ${isSlack ? "Slack" : "Teams"} portal configured`, "success");
      } else {
        addToast(result.error ?? "Alas! The settings would not take hold", "error");
      }
    } catch {
      addToast("Alas! The settings would not take hold", "error");
    } finally {
      setSaving(false);
    }
  };

  const isSlack = config.platform === "SLACK";
  const icon = isSlack ? "\u{1F4AC}" : "\u{1F535}";
  const title = isSlack ? "Slack Portal" : "Teams Portal";
  const urlPlaceholder = isSlack
    ? "https://hooks.slack.com/services/..."
    : "https://outlook.webhook.office.com/...";
  const namePlaceholder = isSlack ? "Slack display name" : "Teams display name";
  const idPlaceholder = isSlack
    ? "Slack member ID (e.g. U0123ABC)"
    : "Teams user ID";

  return (
    <div className="glass-card p-6">
      <div className="text-base font-semibold mb-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-base">
          {icon}
        </div>
        <span>{title}</span>
        <button
          onClick={handleToggle}
          className={`ml-auto relative w-10 h-[22px] rounded-full transition-colors duration-200 ${
            form.isActive ? "bg-narada-emerald" : "bg-white/[0.1]"
          }`}
          aria-label={`${form.isActive ? "Disable" : "Enable"} ${isSlack ? "Slack" : "Teams"}`}
        >
          <span
            className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
              form.isActive ? "translate-x-[18px]" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className={`transition-opacity duration-200 ${!form.isActive ? "opacity-40 pointer-events-none" : ""}`}>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
              Name
            </label>
            <input
              className="glass-input text-[13px]"
              type="text"
              placeholder={namePlaceholder}
              value={form.userName || ""}
              onChange={(e) => update("userName", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
              User ID
            </label>
            <input
              className="glass-input font-mono text-[13px]"
              type="text"
              placeholder={idPlaceholder}
              value={form.userId || ""}
              onChange={(e) => update("userId", e.target.value)}
            />
          </div>
        </div>

        {/* Team Lead for blocker notifications */}
        <div className="grid grid-cols-2 gap-3 mb-1">
          <div>
            <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
              Team Lead Name
            </label>
            <input
              className="glass-input text-[13px]"
              type="text"
              placeholder={isSlack ? "Lead's display name" : "Lead's Teams name"}
              value={form.teamLeadName || ""}
              onChange={(e) => update("teamLeadName", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
              Team Lead ID
            </label>
            <input
              className="glass-input font-mono text-[13px]"
              type="text"
              placeholder={isSlack ? "Lead's Slack ID (e.g. U0456XYZ)" : "Lead's Teams user ID"}
              value={form.teamLeadId || ""}
              onChange={(e) => update("teamLeadId", e.target.value)}
            />
          </div>
        </div>
        <p className="text-[11px] text-narada-text-secondary/60 mb-4">
          The sage shall summon your lead when blockers arise
        </p>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
            Webhook URL
          </label>
          <input
            className={`glass-input font-mono text-[13px] ${errors.webhookUrl ? "!border-narada-rose" : ""}`}
            type="text"
            placeholder={urlPlaceholder}
            value={form.webhookUrl || ""}
            onChange={(e) => update("webhookUrl", e.target.value)}
          />
        </div>

        <div className="flex justify-end mt-4 pt-4 border-t border-white/[0.06]">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Inscribing..." : "Inscribe"}
          </Button>
        </div>
      </div>
    </div>
  );
}
