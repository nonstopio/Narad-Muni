"use client";

import { useState, useEffect, useCallback } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { useToastStore } from "@/components/ui/toast";
import { X } from "lucide-react";
import type { AIProvider } from "@/types";

const PROVIDERS: { value: AIProvider; label: string; description: string }[] = [
  {
    value: "local-claude",
    label: "Local Claude (CLI)",
    description: "Channels wisdom through the Claude CLI on your machine. No API key needed.",
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
      addToast(`${label} key removed`, "success");
    } catch {
      addToast(`Failed to remove ${label} key`, "error");
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
              <button
                onClick={() => handleRemoveKey("geminiApiKey", "Gemini")}
                disabled={removingKey === "geminiApiKey"}
                className="text-xs text-narada-text-muted hover:text-narada-rose transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Remove
              </button>
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
              <button
                onClick={() => handleRemoveKey("claudeApiKey", "Claude")}
                disabled={removingKey === "claudeApiKey"}
                className="text-xs text-narada-text-muted hover:text-narada-rose transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Remove
              </button>
            </div>
          )}
        </div>
      )}

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
            <button
              onClick={() => handleRemoveKey("deepgramApiKey", "Deepgram")}
              disabled={removingKey === "deepgramApiKey"}
              className="text-xs text-narada-text-muted hover:text-narada-rose transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Remove
            </button>
          </div>
        )}
        <p className="text-xs text-narada-text-secondary mt-1.5">
          Required for voice input. Get one at deepgram.com
        </p>
      </div>

      <div className="flex gap-3 mt-4 pt-4 border-t border-white/[0.06]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-8 px-3 rounded-xl bg-narada-primary text-white text-xs font-semibold shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:bg-blue-600 transition-all duration-300 disabled:opacity-50"
        >
          {saving ? "Inscribing..." : "Inscribe"}
        </button>
      </div>
    </div>
  );
}
