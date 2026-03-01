"use client";

import { useState, useEffect, useCallback } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { useToastStore } from "@/components/ui/toast";
import { authedFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { AIProvider } from "@/types";

const PROVIDERS: { value: AIProvider; label: string; description: string }[] = [
  {
    value: "local-claude",
    label: "Local Claude (CLI)",
    description: "Channels wisdom through the Claude CLI on your machine. No API key needed.",
  },
  {
    value: "local-cursor",
    label: "Local Cursor (CLI)",
    description: "Summons the Cursor sage dwelling on your machine. No API key needed.",
  },
  {
    value: "gemini",
    label: "Google Gemini",
    description: "Consults the Gemini oracle. Requires an API key.",
  },
  {
    value: "claude-api",
    label: "Claude API",
    description: "Summons Claude Sonnet through the Anthropic gateway. Requires an API key.",
  },
];

export function AIProviderCard() {
  const { aiSettings, aiLoading, fetchAIProviderSettings, saveAIProviderSettings } =
    useSettingsStore();
  const addToast = useToastStore((s) => s.addToast);

  const [selected, setSelected] = useState<AIProvider>(aiSettings.aiProvider);
  const [geminiKey, setGeminiKey] = useState(aiSettings.geminiApiKey);
  const [claudeKey, setClaudeKey] = useState(aiSettings.claudeApiKey);
  const [deepgramKey, setDeepgramKey] = useState(aiSettings.deepgramApiKey);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [keyError, setKeyError] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const handleRemoveKey = useCallback(async (keyName: string, label: string) => {
    setRemovingKey(keyName);
    try {
      await saveAIProviderSettings({
        aiProvider: selected,
        removeKeys: [keyName],
      });
      if (keyName === "geminiApiKey") setGeminiKey("");
      if (keyName === "claudeApiKey") setClaudeKey("");
      if (keyName === "deepgramApiKey") setDeepgramKey("");
      addToast(`Narayan Narayan! The ${label} mantra has been forgotten`, "success");
    } catch {
      addToast(`Alas! I could not forget the ${label} mantra`, "error");
    } finally {
      setRemovingKey(null);
    }
  }, [selected, saveAIProviderSettings, addToast]);

  useEffect(() => {
    fetchAIProviderSettings();
  }, [fetchAIProviderSettings]);

  useEffect(() => {
    setSelected(aiSettings.aiProvider);
    setGeminiKey(aiSettings.geminiApiKey);
    setClaudeKey(aiSettings.claudeApiKey);
    setDeepgramKey(aiSettings.deepgramApiKey);
  }, [aiSettings]);

  const busy = saving || testing;

  const handleTest = async () => {
    setKeyError(false);
    setTestResult(null);
    // Client-side validation for API-key providers
    if (selected === "gemini" && !geminiKey.trim() && !aiSettings.hasGeminiKey) {
      setKeyError(true);
      setTestResult({ type: "error", message: "The Gemini oracle requires an API key to speak" });
      return;
    }
    if (selected === "claude-api" && !claudeKey.trim() && !aiSettings.hasClaudeKey) {
      setKeyError(true);
      setTestResult({ type: "error", message: "The Claude gateway requires an API key to open" });
      return;
    }

    setTesting(true);
    try {
      const isMasked = (v: string) => v.includes("••••••••");
      const payload: Record<string, unknown> = { provider: selected };

      if (selected === "gemini") {
        if (geminiKey && !isMasked(geminiKey)) {
          payload.geminiApiKey = geminiKey;
        } else {
          payload.useStoredKey = true;
        }
      }
      if (selected === "claude-api") {
        if (claudeKey && !isMasked(claudeKey)) {
          payload.claudeApiKey = claudeKey;
        } else {
          payload.useStoredKey = true;
        }
      }

      const res = await authedFetch("/api/settings/test-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setTestResult({ type: "success", message: "Narayan Narayan! The oracle responds — the connection is divine!" });
      } else {
        setTestResult({ type: "error", message: `Alas! The oracle is silent: ${data.error}` });
      }
    } catch {
      setTestResult({ type: "error", message: "Alas! Could not reach the oracle" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setKeyError(false);
    if (selected === "gemini" && !geminiKey.trim() && !aiSettings.hasGeminiKey) {
      setKeyError(true);
      addToast("The Gemini oracle requires an API key to speak", "error");
      return;
    }
    if (selected === "claude-api" && !claudeKey.trim() && !aiSettings.hasClaudeKey) {
      setKeyError(true);
      addToast("The Claude gateway requires an API key to open", "error");
      return;
    }
    setSaving(true);
    try {
      await saveAIProviderSettings({
        aiProvider: selected,
        geminiApiKey: selected === "gemini" ? geminiKey : undefined,
        claudeApiKey: selected === "claude-api" ? claudeKey : undefined,
        deepgramApiKey: deepgramKey || undefined,
      });
      addToast("Narayan Narayan! Your oracle of choice is set", "success");
    } catch {
      addToast("Alas! The oracle settings could not be preserved", "error");
    } finally {
      setSaving(false);
    }
  };

  if (aiLoading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-5 w-40 bg-white/[0.05] rounded mb-4" />
        <div className="h-4 w-full bg-white/[0.05] rounded" />
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="text-base font-semibold mb-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-base">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-narada-violet">
            <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
            <circle cx="12" cy="15" r="2" />
          </svg>
        </div>
        <span>Divine Oracle</span>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        {PROVIDERS.map((p) => (
          <label
            key={p.value}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
              selected === p.value
                ? "border-narada-primary/50 bg-narada-primary/[0.05]"
                : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
            }`}
          >
            <input
              type="radio"
              name="ai-provider"
              value={p.value}
              checked={selected === p.value}
              onChange={() => setSelected(p.value)}
              className="mt-1 accent-narada-primary"
            />
            <div>
              <div className="text-sm font-medium text-narada-text">{p.label}</div>
              <div className="text-xs text-narada-text-secondary mt-0.5">
                {p.description}
              </div>
            </div>
          </label>
        ))}
      </div>

      {selected === "gemini" && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
            Gemini API Key
          </label>
          <input
            className={`glass-input font-mono text-[13px] ${keyError && selected === "gemini" ? "!border-narada-rose" : ""}`}
            type="password"
            placeholder="AIza..."
            value={geminiKey}
            onChange={(e) => { setGeminiKey(e.target.value); setKeyError(false); }}
          />
          {aiSettings.hasGeminiKey && (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-narada-emerald">Key configured</p>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => handleRemoveKey("geminiApiKey", "Gemini")}
                disabled={removingKey === "geminiApiKey"}
                className="text-narada-text-muted hover:text-narada-rose h-auto py-0 px-1"
              >
                <X className="w-3 h-3" />
                Remove
              </Button>
            </div>
          )}
        </div>
      )}

      {selected === "claude-api" && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
            Anthropic API Key
          </label>
          <input
            className={`glass-input font-mono text-[13px] ${keyError && selected === "claude-api" ? "!border-narada-rose" : ""}`}
            type="password"
            placeholder="sk-ant-..."
            value={claudeKey}
            onChange={(e) => { setClaudeKey(e.target.value); setKeyError(false); }}
          />
          {aiSettings.hasClaudeKey && (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-narada-emerald">Key configured</p>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => handleRemoveKey("claudeApiKey", "Claude")}
                disabled={removingKey === "claudeApiKey"}
                className="text-narada-text-muted hover:text-narada-rose h-auto py-0 px-1"
              >
                <X className="w-3 h-3" />
                Remove
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-white/[0.06] mb-4">
        <Button
          variant="secondary"
          size="default"
          onClick={handleTest}
          disabled={busy}
          className="w-full hover:border-narada-violet/50 hover:text-narada-text hover:bg-narada-violet/[0.05]"
        >
          {testing ? "Consulting the Oracle..." : "Test Connection with Oracle"}
        </Button>
      </div>

      <div className="mt-4 pt-4 border-t border-white/[0.06]">
        <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
          Deepgram API Key
        </label>
        <input
          className="glass-input font-mono text-[13px]"
          type="password"
          placeholder="Enter your Deepgram API key for voice transcription"
          value={deepgramKey}
          onChange={(e) => setDeepgramKey(e.target.value)}
        />
        {aiSettings.hasDeepgramKey && (
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-narada-emerald">Key configured</p>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => handleRemoveKey("deepgramApiKey", "Deepgram")}
              disabled={removingKey === "deepgramApiKey"}
              className="text-narada-text-muted hover:text-narada-rose h-auto py-0 px-1"
            >
              <X className="w-3 h-3" />
              Remove
            </Button>
          </div>
        )}
        <p className="text-xs text-narada-text-secondary mt-1.5">
          I need this mantra to hear your voice. Seek one at deepgram.com
        </p>
      </div>

      <div className="flex justify-end mt-4 pt-4 border-t border-white/[0.06]">
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={busy}
        >
          {saving ? "Inscribing..." : "Inscribe"}
        </Button>
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
                {testResult.type === "success" ? "Oracle Connected" : "Oracle Unreachable"}
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
