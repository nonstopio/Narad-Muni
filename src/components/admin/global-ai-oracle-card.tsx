"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/components/ui/toast";
import { X } from "lucide-react";

type SingleKeySection = { apiKey: string } | null;
type OpenAISection = { apiKey: string; model: string; baseUrl: string } | null;
type AzureSection = {
  apiKey: string;
  endpoint: string;
  deployment: string;
  apiVersion: string;
} | null;

interface GlobalAIConfigResponse {
  claudeApi: SingleKeySection;
  gemini: SingleKeySection;
  groq: SingleKeySection;
  openai: OpenAISection;
  azureOpenai: AzureSection;
  has: {
    claudeApi: boolean;
    gemini: boolean;
    groq: boolean;
    openai: boolean;
    azureOpenai: boolean;
  };
  updatedAt: number | null;
  updatedBy: string | null;
}

type ProviderKey = "claudeApi" | "gemini" | "groq" | "openai" | "azureOpenai";

const PROVIDER_LABELS: Record<ProviderKey, string> = {
  claudeApi: "Claude API",
  gemini: "Google Gemini",
  groq: "Groq",
  openai: "OpenAI",
  azureOpenai: "Azure OpenAI",
};

const MASKED = "••••••••";

function isMasked(v: string) {
  return v.includes(MASKED);
}

export function GlobalAIOracleCard() {
  const addToast = useToastStore((s) => s.addToast);
  const [data, setData] = useState<GlobalAIConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<ProviderKey | null>(null);
  const [removingKey, setRemovingKey] = useState<ProviderKey | null>(null);

  const [claudeKey, setClaudeKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("");
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState("");
  const [azureKey, setAzureKey] = useState("");
  const [azureEndpoint, setAzureEndpoint] = useState("");
  const [azureDeployment, setAzureDeployment] = useState("");
  const [azureApiVersion, setAzureApiVersion] = useState("");

  useEffect(() => {
    authedFetch("/api/admin/config/ai-provider")
      .then((res) => (res.ok ? res.json() : null))
      .then((d: GlobalAIConfigResponse | null) => {
        if (!d) return;
        setData(d);
        setOpenaiModel(d.openai?.model ?? "");
        setOpenaiBaseUrl(d.openai?.baseUrl ?? "");
        setAzureEndpoint(d.azureOpenai?.endpoint ?? "");
        setAzureDeployment(d.azureOpenai?.deployment ?? "");
        setAzureApiVersion(d.azureOpenai?.apiVersion ?? "2024-08-01-preview");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refresh = async () => {
    const res = await authedFetch("/api/admin/config/ai-provider");
    if (!res.ok) return;
    const d = (await res.json()) as GlobalAIConfigResponse;
    setData(d);
    setClaudeKey("");
    setGeminiKey("");
    setGroqKey("");
    setOpenaiKey("");
    setAzureKey("");
    setOpenaiModel(d.openai?.model ?? "");
    setOpenaiBaseUrl(d.openai?.baseUrl ?? "");
    setAzureEndpoint(d.azureOpenai?.endpoint ?? "");
    setAzureDeployment(d.azureOpenai?.deployment ?? "");
    setAzureApiVersion(d.azureOpenai?.apiVersion ?? "2024-08-01-preview");
  };

  const saveSection = async (provider: ProviderKey, payload: Record<string, unknown>) => {
    setSavingKey(provider);
    try {
      const res = await authedFetch("/api/admin/config/ai-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [provider]: payload }),
      });
      if (!res.ok) throw new Error("Save failed");
      addToast(`Narayan Narayan! ${PROVIDER_LABELS[provider]} is inscribed for all devotees.`, "success");
      await refresh();
    } catch (err) {
      console.error("[Narada Admin] GlobalAIOracle save:", err);
      addToast(`Alas! ${PROVIDER_LABELS[provider]} could not be inscribed.`, "error");
    } finally {
      setSavingKey(null);
    }
  };

  const removeSection = async (provider: ProviderKey) => {
    setRemovingKey(provider);
    try {
      const res = await authedFetch("/api/admin/config/ai-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeProviders: [provider] }),
      });
      if (!res.ok) throw new Error("Remove failed");
      addToast(`Narayan Narayan! ${PROVIDER_LABELS[provider]} oracle has been forgotten.`, "success");
      await refresh();
    } catch (err) {
      console.error("[Narada Admin] GlobalAIOracle remove:", err);
      addToast(`Alas! ${PROVIDER_LABELS[provider]} could not be forgotten.`, "error");
    } finally {
      setRemovingKey(null);
    }
  };

  const renderStatusRow = (provider: ProviderKey) => {
    const has = data?.has?.[provider];
    return (
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium narada-text">{PROVIDER_LABELS[provider]}</h4>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              has
                ? "bg-emerald-500/10 text-narada-emerald border border-emerald-500/30"
                : "bg-white/[0.04] text-narada-text-secondary border border-white/[0.06]"
            }`}
          >
            {has ? "Bestowed" : "Empty"}
          </span>
        </div>
        {has && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => removeSection(provider)}
            disabled={removingKey === provider}
            className="text-narada-text-muted hover:text-narada-rose h-auto py-0 px-1"
          >
            <X className="w-3 h-3" />
            Remove
          </Button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="glass-card p-5">
        <h3 className="text-sm font-medium narada-text-secondary mb-4">Global AI Oracle</h3>
        <p className="text-xs narada-text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-medium narada-text-secondary mb-1">Global AI Oracle</h3>
      <p className="text-[11px] narada-text-secondary mb-4">
        Bestow keys here so any devotee may channel the oracle without holding their own. Personal keys still take precedence unless a devotee opts in.
      </p>

      <div className="space-y-5">
        {/* Claude API */}
        <div className="border border-white/[0.06] rounded-xl p-3">
          {renderStatusRow("claudeApi")}
          <input
            className="glass-input font-mono text-[13px]"
            type="password"
            placeholder={data?.claudeApi?.apiKey || "sk-ant-..."}
            value={claudeKey}
            onChange={(e) => setClaudeKey(e.target.value)}
          />
          <div className="flex justify-end mt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => saveSection("claudeApi", { apiKey: claudeKey })}
              disabled={!claudeKey || isMasked(claudeKey) || savingKey === "claudeApi"}
            >
              {savingKey === "claudeApi" ? "Inscribing..." : "Inscribe"}
            </Button>
          </div>
        </div>

        {/* Gemini */}
        <div className="border border-white/[0.06] rounded-xl p-3">
          {renderStatusRow("gemini")}
          <input
            className="glass-input font-mono text-[13px]"
            type="password"
            placeholder={data?.gemini?.apiKey || "AIza..."}
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
          />
          <div className="flex justify-end mt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => saveSection("gemini", { apiKey: geminiKey })}
              disabled={!geminiKey || isMasked(geminiKey) || savingKey === "gemini"}
            >
              {savingKey === "gemini" ? "Inscribing..." : "Inscribe"}
            </Button>
          </div>
        </div>

        {/* Groq */}
        <div className="border border-white/[0.06] rounded-xl p-3">
          {renderStatusRow("groq")}
          <input
            className="glass-input font-mono text-[13px]"
            type="password"
            placeholder={data?.groq?.apiKey || "gsk_..."}
            value={groqKey}
            onChange={(e) => setGroqKey(e.target.value)}
          />
          <div className="flex justify-end mt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => saveSection("groq", { apiKey: groqKey })}
              disabled={!groqKey || isMasked(groqKey) || savingKey === "groq"}
            >
              {savingKey === "groq" ? "Inscribing..." : "Inscribe"}
            </Button>
          </div>
        </div>

        {/* OpenAI */}
        <div className="border border-white/[0.06] rounded-xl p-3">
          {renderStatusRow("openai")}
          <input
            className="glass-input font-mono text-[13px] mb-2"
            type="password"
            placeholder={data?.openai?.apiKey || "sk-..."}
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              className="glass-input font-mono text-[13px]"
              type="text"
              placeholder="Model (e.g. gpt-4o)"
              value={openaiModel}
              onChange={(e) => setOpenaiModel(e.target.value)}
            />
            <input
              className="glass-input font-mono text-[13px]"
              type="text"
              placeholder="Base URL (optional)"
              value={openaiBaseUrl}
              onChange={(e) => setOpenaiBaseUrl(e.target.value)}
            />
          </div>
          <div className="flex justify-end mt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                saveSection("openai", {
                  apiKey: openaiKey,
                  model: openaiModel,
                  baseUrl: openaiBaseUrl,
                })
              }
              disabled={
                savingKey === "openai" ||
                (!openaiKey && !data?.has?.openai) ||
                (!!openaiKey && isMasked(openaiKey))
              }
            >
              {savingKey === "openai" ? "Inscribing..." : "Inscribe"}
            </Button>
          </div>
        </div>

        {/* Azure OpenAI */}
        <div className="border border-white/[0.06] rounded-xl p-3">
          {renderStatusRow("azureOpenai")}
          <input
            className="glass-input font-mono text-[13px] mb-2"
            type="password"
            placeholder={data?.azureOpenai?.apiKey || "your-azure-key"}
            value={azureKey}
            onChange={(e) => setAzureKey(e.target.value)}
          />
          <input
            className="glass-input font-mono text-[13px] mb-2"
            type="text"
            placeholder="https://your-resource.openai.azure.com"
            value={azureEndpoint}
            onChange={(e) => setAzureEndpoint(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              className="glass-input font-mono text-[13px]"
              type="text"
              placeholder="Deployment (e.g. gpt-4o)"
              value={azureDeployment}
              onChange={(e) => setAzureDeployment(e.target.value)}
            />
            <input
              className="glass-input font-mono text-[13px]"
              type="text"
              placeholder="2024-08-01-preview"
              value={azureApiVersion}
              onChange={(e) => setAzureApiVersion(e.target.value)}
            />
          </div>
          <div className="flex justify-end mt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                saveSection("azureOpenai", {
                  apiKey: azureKey,
                  endpoint: azureEndpoint,
                  deployment: azureDeployment,
                  apiVersion: azureApiVersion,
                })
              }
              disabled={
                savingKey === "azureOpenai" ||
                (!azureKey && !data?.has?.azureOpenai) ||
                (!!azureKey && isMasked(azureKey)) ||
                !azureEndpoint ||
                !azureDeployment ||
                !azureApiVersion
              }
            >
              {savingKey === "azureOpenai" ? "Inscribing..." : "Inscribe"}
            </Button>
          </div>
        </div>
      </div>

      {data?.updatedAt && (
        <p className="text-[10px] narada-text-secondary mt-4">
          Last inscribed: {new Date(data.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
