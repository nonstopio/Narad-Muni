import { create } from "zustand";
import { authedFetch } from "@/lib/api-client";
import { trackEvent } from "@/lib/analytics";
import type { PlatformConfigData, AIProvider, KeyProvider } from "@/types";

export type UseGlobalForMap = Partial<Record<KeyProvider, boolean>>;

interface AIProviderSettings {
  aiProvider: AIProvider;
  geminiApiKey: string;
  claudeApiKey: string;
  deepgramApiKey: string;
  groqApiKey: string;
  openaiApiKey: string;
  azureOpenaiApiKey: string;
  azureOpenaiEndpoint: string;
  azureOpenaiDeployment: string;
  azureOpenaiApiVersion: string;
  hasGeminiKey: boolean;
  hasClaudeKey: boolean;
  hasDeepgramKey: boolean;
  hasGroqKey: boolean;
  hasOpenaiKey: boolean;
  hasAzureOpenaiKey: boolean;
  hasAzureOpenaiEndpoint: boolean;
  hasAzureOpenaiDeployment: boolean;
  useGlobalFor: UseGlobalForMap;
}

const EMPTY_AI_SETTINGS: AIProviderSettings = {
  aiProvider: "local-claude",
  geminiApiKey: "",
  claudeApiKey: "",
  deepgramApiKey: "",
  groqApiKey: "",
  openaiApiKey: "",
  azureOpenaiApiKey: "",
  azureOpenaiEndpoint: "",
  azureOpenaiDeployment: "",
  azureOpenaiApiVersion: "",
  hasGeminiKey: false,
  hasClaudeKey: false,
  hasDeepgramKey: false,
  hasGroqKey: false,
  hasOpenaiKey: false,
  hasAzureOpenaiKey: false,
  hasAzureOpenaiEndpoint: false,
  hasAzureOpenaiDeployment: false,
  useGlobalFor: {},
};

function mapApiToSettings(data: Record<string, unknown>): AIProviderSettings {
  return {
    aiProvider: (data.aiProvider as AIProvider) ?? "local-claude",
    geminiApiKey: (data.geminiApiKey as string) ?? "",
    claudeApiKey: (data.claudeApiKey as string) ?? "",
    deepgramApiKey: (data.deepgramApiKey as string) ?? "",
    groqApiKey: (data.groqApiKey as string) ?? "",
    openaiApiKey: (data.openaiApiKey as string) ?? "",
    azureOpenaiApiKey: (data.azureOpenaiApiKey as string) ?? "",
    azureOpenaiEndpoint: (data.azureOpenaiEndpoint as string) ?? "",
    azureOpenaiDeployment: (data.azureOpenaiDeployment as string) ?? "",
    azureOpenaiApiVersion: (data.azureOpenaiApiVersion as string) ?? "",
    hasGeminiKey: !!data.hasGeminiKey,
    hasClaudeKey: !!data.hasClaudeKey,
    hasDeepgramKey: !!data.hasDeepgramKey,
    hasGroqKey: !!data.hasGroqKey,
    hasOpenaiKey: !!data.hasOpenaiKey,
    hasAzureOpenaiKey: !!data.hasAzureOpenaiKey,
    hasAzureOpenaiEndpoint: !!data.hasAzureOpenaiEndpoint,
    hasAzureOpenaiDeployment: !!data.hasAzureOpenaiDeployment,
    useGlobalFor: (data.useGlobalFor as UseGlobalForMap) ?? {},
  };
}

export interface SaveAIProviderPayload {
  aiProvider: AIProvider;
  geminiApiKey?: string;
  claudeApiKey?: string;
  deepgramApiKey?: string;
  groqApiKey?: string;
  openaiApiKey?: string;
  azureOpenaiApiKey?: string;
  azureOpenaiEndpoint?: string;
  azureOpenaiDeployment?: string;
  azureOpenaiApiVersion?: string;
  useGlobalFor?: UseGlobalForMap;
  removeKeys?: string[];
}

interface SettingsStore {
  configs: PlatformConfigData[];
  loading: boolean;
  setConfigs: (configs: PlatformConfigData[]) => void;
  setLoading: (loading: boolean) => void;
  fetchConfigs: () => Promise<void>;
  saveConfig: (config: PlatformConfigData) => Promise<{ success: boolean; error?: string }>;

  // AI provider
  aiSettings: AIProviderSettings;
  aiLoading: boolean;
  aiError: boolean;
  fetchAIProviderSettings: () => Promise<void>;
  saveAIProviderSettings: (data: SaveAIProviderPayload) => Promise<void>;

  // Global AI status (read-only — set by admin)
  globalAIStatus: Record<string, boolean>;
  fetchGlobalAIStatus: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  configs: [],
  loading: false,
  setConfigs: (configs) => set({ configs }),
  setLoading: (loading) => set({ loading }),

  fetchConfigs: async () => {
    set({ loading: true });
    try {
      const res = await authedFetch("/api/settings");
      const data = await res.json();
      if (data.configs) {
        set({ configs: data.configs });
      }
    } catch (err) {
      console.error("[Narada] fetchConfigs:", err);
    } finally {
      set({ loading: false });
    }
  },

  saveConfig: async (config) => {
    try {
      const putRes = await authedFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!putRes.ok) {
        return { success: false, error: "Failed to save settings" };
      }
      const result = await putRes.json();
      if (result.success === false) {
        return { success: false, error: result.error ?? "Failed to save settings" };
      }
      const res = await authedFetch("/api/settings");
      const data = await res.json();
      if (data.configs) {
        set({ configs: data.configs });
      }
      trackEvent("settings_save", { platform: config.platform });
      return { success: true };
    } catch {
      return { success: false, error: "Network error — could not save settings" };
    }
  },

  // AI provider
  aiSettings: EMPTY_AI_SETTINGS,
  aiLoading: false,
  aiError: false,

  fetchAIProviderSettings: async () => {
    set({ aiLoading: true, aiError: false });
    try {
      const res = await authedFetch("/api/settings/ai-provider");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      set({ aiLoading: false, aiSettings: mapApiToSettings(data) });
    } catch (err) {
      console.error("[Narada] fetchAIProviderSettings:", err);
      set({ aiError: true, aiLoading: false });
    }
  },

  saveAIProviderSettings: async (data) => {
    trackEvent("ai_provider_change", { provider: data.aiProvider });
    try {
      const res = await authedFetch("/api/settings/ai-provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const updated = await res.json();
      set({ aiSettings: mapApiToSettings(updated) });
    } catch (err) {
      console.error("[Narada] saveAIProviderSettings:", err);
      throw err;
    }
  },

  globalAIStatus: {},
  fetchGlobalAIStatus: async () => {
    try {
      const res = await authedFetch("/api/settings/global-ai-status");
      if (!res.ok) return;
      const data = await res.json();
      set({ globalAIStatus: data as Record<string, boolean> });
    } catch (err) {
      console.error("[Narada] fetchGlobalAIStatus:", err);
    }
  },
}));
