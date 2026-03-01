"use client";

import { useState } from "react";
import { MessageSquareReply, Link } from "lucide-react";
import { authedFetch } from "@/lib/api-client";
import type { PlatformConfigData } from "@/types";
import { useToastStore } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

interface Props {
  config: PlatformConfigData;
  onSave: (config: PlatformConfigData) => Promise<{ success: boolean; error?: string }>;
  onToggle: (config: PlatformConfigData) => Promise<{ success: boolean; error?: string }>;
}

/** Generate 5-minute increment time options from 00:00 to 23:55. */
function generateTimeOptions(): { value: string; label: string }[] {
  return Array.from({ length: 288 }, (_, i) => {
    const hh = String(Math.floor((i * 5) / 60)).padStart(2, "0");
    const mm = String((i * 5) % 60).padStart(2, "0");
    return { value: `${hh}:${mm}`, label: `${hh}:${mm}` };
  });
}

const TIME_OPTIONS = generateTimeOptions();

export function PlatformConfigCard({ config, onSave, onToggle }: Props) {
  const [form, setForm] = useState(config);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const addToast = useToastStore((s) => s.addToast);

  const update = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: false }));
  };

  const validate = (): string | null => {
    const newErrors: Record<string, boolean> = {};

    if (isSlack && form.slackThreadMode) {
      // Thread mode: bot token + channel ID + workflow time required
      const token = form.slackBotToken?.trim();
      if (!token || !token.startsWith("xoxb-")) {
        newErrors.slackBotToken = true;
      }
      const channel = form.slackChannelId?.trim();
      if (!channel || !channel.startsWith("C")) {
        newErrors.slackChannelId = true;
      }
      const wfTime = form.slackWorkflowTime?.trim();
      if (!wfTime) {
        newErrors.slackWorkflowTime = true;
      }
      setErrors(newErrors);
      if (newErrors.slackBotToken) return "A valid Bot Token (xoxb-...) is needed for thread reply mode";
      if (newErrors.slackChannelId) return "A valid Channel ID (C...) is needed for thread reply mode";
      if (newErrors.slackWorkflowTime) return "Select the time when the workflow message posts";
    } else if (isSlack) {
      // Standard webhook mode
      const url = form.webhookUrl?.trim();
      if (!url) {
        newErrors.webhookUrl = true;
      } else if (!/^https?:\/\/.+/.test(url)) {
        newErrors.webhookUrl = true;
      }
      setErrors(newErrors);
      if (newErrors.webhookUrl) return "A valid Webhook URL is needed to open this portal";
    } else {
      // Teams — always webhook
      const url = form.webhookUrl?.trim();
      if (!url) {
        newErrors.webhookUrl = true;
      } else if (!/^https?:\/\/.+/.test(url)) {
        newErrors.webhookUrl = true;
      }
      setErrors(newErrors);
      if (newErrors.webhookUrl) return "A valid Webhook URL is needed to open this portal";
    }

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

  const handleTestThread = async () => {
    setTestResult(null);
    const token = form.slackBotToken?.trim();
    const channel = form.slackChannelId?.trim();
    const wfTime = form.slackWorkflowTime?.trim();
    if (!token || !token.startsWith("xoxb-") || !channel || !channel.startsWith("C") || !wfTime) {
      addToast("Bot Token (xoxb-...), Channel ID (C...), and Workflow Time are required", "error");
      return;
    }
    setTesting(true);
    try {
      const res = await authedFetch("/api/settings/test-slack-thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: token,
          channelId: channel,
          workflowTime: wfTime,
          matchText: form.slackThreadMatch || undefined,
          timezone: form.timezone || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({ type: "success", message: data.message });
      } else {
        setTestResult({ type: "error", message: data.error });
      }
    } catch {
      setTestResult({ type: "error", message: "Alas! Could not reach the Slack realm" });
    } finally {
      setTesting(false);
    }
  };

  const isSlack = config.platform === "SLACK";
  const icon = isSlack ? "\u{1F4AC}" : "\u{1F535}";
  const title = isSlack ? "Slack Portal" : "Teams Portal";
  const urlPlaceholder = isSlack
    ? "https://hooks.slack.com/services/..."
    : "https://outlook.webhook.office.com/...";
  const namePlaceholder = isSlack ? "Slack display name (optional)" : "Teams display name";
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
              placeholder={isSlack ? "Lead's display name (optional)" : "Lead's Teams name"}
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

        {/* Slack Delivery Mode — segmented control */}
        {isSlack && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
              Delivery Mode
            </label>
            <div className="relative flex bg-white/[0.04] border border-white/[0.06] rounded-xl p-1">
              {/* Sliding pill background */}
              <div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-out ${
                  form.slackThreadMode
                    ? "left-1 bg-narada-violet/20 border border-narada-violet/30"
                    : "left-[calc(50%+2px)] bg-narada-primary/20 border border-narada-primary/30"
                }`}
              />
              <button
                type="button"
                onClick={() => update("slackThreadMode", true)}
                className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium transition-colors duration-300 ${
                  form.slackThreadMode ? "text-narada-text-primary" : "text-narada-text-secondary"
                }`}
              >
                <MessageSquareReply size={14} />
                Thread Reply
              </button>
              <button
                type="button"
                onClick={() => update("slackThreadMode", false)}
                className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-medium transition-colors duration-300 ${
                  !form.slackThreadMode ? "text-narada-text-primary" : "text-narada-text-secondary"
                }`}
              >
                <Link size={14} />
                Webhook
              </button>
            </div>
            <p className="text-[11px] text-narada-text-secondary/60 mt-2">
              {form.slackThreadMode
                ? "The sage replies within your daily workflow thread"
                : "The sage sends scrolls directly via webhook"}
            </p>
          </div>
        )}

        {/* Slack Thread Reply Mode fields — shown when thread mode ON */}
        {isSlack && form.slackThreadMode && (
          <div className="mb-4">
            <div className="pl-0 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
                  Bot Token
                </label>
                <input
                  className={`glass-input font-mono text-[13px] ${errors.slackBotToken ? "!border-narada-rose" : ""}`}
                  type="password"
                  placeholder="xoxb-..."
                  value={form.slackBotToken || ""}
                  onChange={(e) => update("slackBotToken", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
                  Channel ID
                </label>
                <input
                  className={`glass-input font-mono text-[13px] ${errors.slackChannelId ? "!border-narada-rose" : ""}`}
                  type="text"
                  placeholder="C0123ABCDEF"
                  value={form.slackChannelId || ""}
                  onChange={(e) => update("slackChannelId", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
                  Workflow Time
                </label>
                <select
                  className={`glass-input text-[13px] ${errors.slackWorkflowTime ? "!border-narada-rose" : ""}`}
                  value={form.slackWorkflowTime || ""}
                  onChange={(e) => update("slackWorkflowTime", e.target.value)}
                >
                  <option value="">Select time...</option>
                  {TIME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-narada-text-secondary/60 mt-1">
                  When does the workflow message post? The sage searches a 10-minute window around this time.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
                  Thread Match Text
                </label>
                <input
                  className="glass-input text-[13px]"
                  type="text"
                  placeholder="Daily Status Update"
                  value={form.slackThreadMatch || ""}
                  onChange={(e) => update("slackThreadMatch", e.target.value)}
                />
                <p className="text-[11px] text-narada-text-secondary/60 mt-1">
                  Text to find in the workflow message (defaults to &quot;Daily Status Update&quot;)
                </p>
              </div>

              <div className="text-[11px] text-narada-text-secondary/50 bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
                <p className="font-semibold text-narada-text-secondary/70 mb-1">Setup:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Create a Slack App at api.slack.com/apps</li>
                  <li>Add scopes: <code className="font-mono text-narada-violet/80">channels:history</code>, <code className="font-mono text-narada-violet/80">chat:write</code></li>
                  <li>Install to workspace, copy Bot Token</li>
                  <li>Invite bot to channel: <code className="font-mono text-narada-violet/80">/invite @BotName</code></li>
                  <li>Get Channel ID from channel details</li>
                </ol>
              </div>

              <div className="mt-3">
                <Button
                  variant="secondary"
                  size="default"
                  onClick={handleTestThread}
                  disabled={saving || testing}
                  className="w-full hover:border-narada-violet/50 hover:text-narada-text hover:bg-narada-violet/[0.05]"
                >
                  {testing ? "Seeking the workflow thread..." : "Test Thread Connection"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Webhook URL — hidden when Slack thread mode is ON */}
        {!(isSlack && form.slackThreadMode) && (
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
        )}

        <div className="flex justify-end mt-4 pt-4 border-t border-white/[0.06]">
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
                {testResult.type === "success" ? "Workflow Thread Found" : "Thread Not Found"}
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
