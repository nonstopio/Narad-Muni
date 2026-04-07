"use client";

import { useState, useEffect, useCallback } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { useToastStore } from "@/components/ui/toast";
import { authedFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ExternalLink, X } from "lucide-react";
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
  {
    value: "groq",
    label: "Groq",
    description: "Invokes the swift Groq oracle — blazing fast inference. Requires an API key.",
  },
];

const API_KEY_CONFIGS: {
  provider: AIProvider;
  field: string;
  hasField: "hasGeminiKey" | "hasClaudeKey" | "hasGroqKey";
  label: string;
  displayName: string;
  placeholder: string;
  errorMsg: string;
  keyUrl: string;
}[] = [
  { provider: "gemini", field: "geminiApiKey", hasField: "hasGeminiKey", label: "Gemini API Key", displayName: "Gemini", placeholder: "AIza...", errorMsg: "The Gemini oracle requires an API key to speak", keyUrl: "https://aistudio.google.com/apikey" },
  { provider: "claude-api", field: "claudeApiKey", hasField: "hasClaudeKey", label: "Anthropic API Key", displayName: "Claude", placeholder: "sk-ant-...", errorMsg: "The Claude gateway requires an API key to open", keyUrl: "https://console.anthropic.com/settings/keys" },
  { provider: "groq", field: "groqApiKey", hasField: "hasGroqKey", label: "Groq API Key", displayName: "Groq", placeholder: "gsk_...", errorMsg: "The Groq oracle requires an API key to awaken", keyUrl: "https://console.groq.com/keys" },
];

export function AIProviderCard() {
  const { aiSettings, aiLoading, fetchAIProviderSettings, saveAIProviderSettings } =
    useSettingsStore();
  const addToast = useToastStore((s) => s.addToast);

  const [selected, setSelected] = useState<AIProvider>(aiSettings.aiProvider);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    geminiApiKey: aiSettings.geminiApiKey,
    claudeApiKey: aiSettings.claudeApiKey,
    groqApiKey: aiSettings.groqApiKey,
  });
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
      if (keyName === "deepgramApiKey") {
        setDeepgramKey("");
      } else {
        setApiKeys((prev) => ({ ...prev, [keyName]: "" }));
      }
      addToast(`Narayan Narayan! The ${label} mantra has been forgotten`, "success");
    } catch (err) {
      console.error("[Narada] AIProviderCard handleRemoveKey:", err);
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
    setApiKeys({
      geminiApiKey: aiSettings.geminiApiKey,
      claudeApiKey: aiSettings.claudeApiKey,
      groqApiKey: aiSettings.groqApiKey,
    });
    setDeepgramKey(aiSettings.deepgramApiKey);
  }, [aiSettings]);

  const busy = saving || testing;

  const getActiveKeyConfig = () => API_KEY_CONFIGS.find((c) => c.provider === selected);

  const handleTest = async () => {
    setKeyError(false);
    setTestResult(null);

    const config = getActiveKeyConfig();
    if (config && !apiKeys[config.field]?.trim() && !aiSettings[config.hasField]) {
      setKeyError(true);
      setTestResult({ type: "error", message: config.errorMsg });
      return;
    }

    setTesting(true);
    try {
      const isMasked = (v: string) => v.includes("••••••••");
      const payload: Record<string, unknown> = { provider: selected };

      if (config) {
        const keyValue = apiKeys[config.field];
        if (keyValue && !isMasked(keyValue)) {
          payload[config.field] = keyValue;
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
    } catch (err) {
      console.error("[Narada] AIProviderCard handleTest:", err);
      setTestResult({ type: "error", message: "Alas! Could not reach the oracle" });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setKeyError(false);

    const config = getActiveKeyConfig();
    if (config && !apiKeys[config.field]?.trim() && !aiSettings[config.hasField]) {
      setKeyError(true);
      addToast(config.errorMsg, "error");
      return;
    }

    setSaving(true);
    try {
      const saveData: Record<string, unknown> = { aiProvider: selected };
      if (config) {
        saveData[config.field] = apiKeys[config.field] || undefined;
      }
      saveData.deepgramApiKey = deepgramKey || undefined;

      await saveAIProviderSettings(saveData as Parameters<typeof saveAIProviderSettings>[0]);
      addToast("Narayan Narayan! Your oracle of choice is set", "success");
    } catch (err) {
      console.error("[Narada] AIProviderCard handleSave:", err);
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

  const activeKeyConfig = getActiveKeyConfig();

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

      {activeKeyConfig && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
            {activeKeyConfig.label}
          </label>
          <input
            className={`glass-input font-mono text-[13px] ${keyError ? "!border-narada-rose" : ""}`}
            type="password"
            placeholder={activeKeyConfig.placeholder}
            value={apiKeys[activeKeyConfig.field] ?? ""}
            onChange={(e) => { setApiKeys((prev) => ({ ...prev, [activeKeyConfig.field]: e.target.value })); setKeyError(false); }}
          />
          <div className="flex items-center gap-2 mt-1.5">
            <a
              href={activeKeyConfig.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-narada-primary hover:text-narada-primary/80 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Get API Key
            </a>
          </div>
          {aiSettings[activeKeyConfig.hasField] && (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-narada-emerald">Key configured</p>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => handleRemoveKey(activeKeyConfig.field, activeKeyConfig.displayName)}
                disabled={removingKey === activeKeyConfig.field}
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
