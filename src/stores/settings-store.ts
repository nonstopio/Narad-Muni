import { create } from "zustand";
import type { PlatformConfigData, AIProvider } from "@/types";

interface AIProviderSettings {
  aiProvider: AIProvider;
  geminiApiKey: string;
  claudeApiKey: string;
  deepgramApiKey: string;
  hasGeminiKey: boolean;
  hasClaudeKey: boolean;
  hasDeepgramKey: boolean;
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
  fetchAIProviderSettings: () => Promise<void>;
  saveAIProviderSettings: (data: {
    aiProvider: AIProvider;
    geminiApiKey?: string;
    claudeApiKey?: string;
    deepgramApiKey?: string;
    removeKeys?: string[];
  }) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  configs: [],
  loading: false,
  setConfigs: (configs) => set({ configs }),
  setLoading: (loading) => set({ loading }),

  fetchConfigs: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.configs) {
        set({ configs: data.configs });
      }
    } finally {
      set({ loading: false });
    }
  },

  saveConfig: async (config) => {
    try {
      const putRes = await fetch("/api/settings", {
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
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.configs) {
        set({ configs: data.configs });
      }
      return { success: true };
    } catch {
      return { success: false, error: "Network error — could not save settings" };
    }
  },

  // AI provider
  aiSettings: {
    aiProvider: "local-claude",
    geminiApiKey: "",
    claudeApiKey: "",
    deepgramApiKey: "",
    hasGeminiKey: false,
    hasClaudeKey: false,
    hasDeepgramKey: false,
  },
  aiLoading: false,

  fetchAIProviderSettings: async () => {
    set({ aiLoading: true });
    try {
      const res = await fetch("/api/settings/ai-provider");
      const data = await res.json();
      set({
        aiSettings: {
          aiProvider: data.aiProvider ?? "local-claude",
          geminiApiKey: data.geminiApiKey ?? "",
          claudeApiKey: data.claudeApiKey ?? "",
          deepgramApiKey: data.deepgramApiKey ?? "",
          hasGeminiKey: data.hasGeminiKey ?? false,
          hasClaudeKey: data.hasClaudeKey ?? false,
          hasDeepgramKey: data.hasDeepgramKey ?? false,
        },
      });
    } finally {
      set({ aiLoading: false });
    }
  },

  saveAIProviderSettings: async (data) => {
    const res = await fetch("/api/settings/ai-provider", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const updated = await res.json();
    set({
      aiSettings: {
        aiProvider: updated.aiProvider ?? "local-claude",
        geminiApiKey: updated.geminiApiKey ?? "",
        claudeApiKey: updated.claudeApiKey ?? "",
        deepgramApiKey: updated.deepgramApiKey ?? "",
        hasGeminiKey: updated.hasGeminiKey ?? false,
        hasClaudeKey: updated.hasClaudeKey ?? false,
        hasDeepgramKey: updated.hasDeepgramKey ?? false,
      },
    });
  },
}));
