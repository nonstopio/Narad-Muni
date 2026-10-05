import { FieldValue } from "firebase-admin/firestore";
import type { AIProvider, KeyProvider } from "@/types";
import type { UseGlobalFor } from "@/lib/ai";
import { resolveAiTimeout } from "./ai-timeout";

export const VALID_PROVIDERS: AIProvider[] = [
  "gemini",
  "claude-api",
  "local-claude",
  "local-cursor",
  "groq",
  "openai",
  "azure-openai",
];
export const MASKED = "••••••••";

export function maskKey(key: string | null | undefined): string {
  if (!key) return "";
  if (key.length <= 8) return MASKED;
  return key.slice(0, 4) + MASKED + key.slice(-4);
}

export interface StoredSettings {
  aiProvider?: string;
  geminiApiKey?: string | null;
  claudeApiKey?: string | null;
  groqApiKey?: string | null;
  openaiApiKey?: string | null;
  azureOpenaiApiKey?: string | null;
  azureOpenaiEndpoint?: string | null;
  azureOpenaiDeployment?: string | null;
  azureOpenaiApiVersion?: string | null;
  useGlobalFor?: UseGlobalFor;
  aiTimeoutMs?: number;
}

export const REMOVABLE_FIELDS = [
  "geminiApiKey",
  "claudeApiKey",
  "groqApiKey",
  "openaiApiKey",
  "azureOpenaiApiKey",
  "azureOpenaiEndpoint",
  "azureOpenaiDeployment",
  "azureOpenaiApiVersion",
] as const;

export function normalizeUseGlobalFor(input: unknown): UseGlobalFor | undefined {
  if (!input || typeof input !== "object") return undefined;
  const src = input as Record<string, unknown>;
  const keys: KeyProvider[] = ["claude-api", "gemini", "groq", "openai", "azure-openai"];
  const out: UseGlobalFor = {};
  for (const k of keys) {
    if (typeof src[k] === "boolean") out[k] = src[k] as boolean;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function buildSettingsResponse(settings: StoredSettings | undefined) {
  const useGlobalFor: UseGlobalFor = settings?.useGlobalFor ?? {};
  return {
    aiProvider: settings?.aiProvider ?? "local-claude",
    geminiApiKey: maskKey(settings?.geminiApiKey),
    claudeApiKey: maskKey(settings?.claudeApiKey),
    groqApiKey: maskKey(settings?.groqApiKey),
    openaiApiKey: maskKey(settings?.openaiApiKey),
    azureOpenaiApiKey: maskKey(settings?.azureOpenaiApiKey),
    azureOpenaiEndpoint: settings?.azureOpenaiEndpoint ?? "",
    azureOpenaiDeployment: settings?.azureOpenaiDeployment ?? "",
    azureOpenaiApiVersion: settings?.azureOpenaiApiVersion ?? "",
    hasGeminiKey: !!settings?.geminiApiKey,
    hasClaudeKey: !!settings?.claudeApiKey,
    hasGroqKey: !!settings?.groqApiKey,
    hasOpenaiKey: !!settings?.openaiApiKey,
    hasAzureOpenaiKey: !!settings?.azureOpenaiApiKey,
    hasAzureOpenaiEndpoint: !!settings?.azureOpenaiEndpoint,
    hasAzureOpenaiDeployment: !!settings?.azureOpenaiDeployment,
    useGlobalFor,
    aiTimeoutMs: resolveAiTimeout(settings?.aiTimeoutMs),
  };
}

function applyKeyField(updateData: Record<string, unknown>, key: string, value: unknown) {
  if (typeof value !== "string") return;
  if (!value) return;
  if (value.includes(MASKED)) return;
  updateData[key] = value;
}

function applyPlainField(updateData: Record<string, unknown>, key: string, value: unknown) {
  if (typeof value !== "string") return;
  if (!value) return;
  updateData[key] = value;
}

/** The settings write for a PUT body, minus the useGlobalFor merge (which reads Firestore). */
export function buildSettingsUpdate(body: Record<string, unknown>): Record<string, unknown> {
  const {
    aiProvider,
    geminiApiKey,
    claudeApiKey,
    groqApiKey,
    openaiApiKey,
    azureOpenaiApiKey,
    azureOpenaiEndpoint,
    azureOpenaiDeployment,
    azureOpenaiApiVersion,
    aiTimeoutMs,
    removeKeys,
  } = body;

  const updateData: Record<string, unknown> = {};
  if (aiProvider) updateData.aiProvider = aiProvider;
  if (aiTimeoutMs !== undefined) updateData.aiTimeoutMs = resolveAiTimeout(aiTimeoutMs);

  applyKeyField(updateData, "geminiApiKey", geminiApiKey);
  applyKeyField(updateData, "claudeApiKey", claudeApiKey);
  applyKeyField(updateData, "groqApiKey", groqApiKey);
  applyKeyField(updateData, "openaiApiKey", openaiApiKey);
  applyKeyField(updateData, "azureOpenaiApiKey", azureOpenaiApiKey);

  applyPlainField(updateData, "azureOpenaiEndpoint", azureOpenaiEndpoint);
  applyPlainField(updateData, "azureOpenaiDeployment", azureOpenaiDeployment);
  applyPlainField(updateData, "azureOpenaiApiVersion", azureOpenaiApiVersion);

  const keysToRemove: string[] = Array.isArray(removeKeys) ? removeKeys : [];
  for (const key of keysToRemove) {
    if ((REMOVABLE_FIELDS as readonly string[]).includes(key)) {
      updateData[key] = null;
    }
  }

  // Deepgram was removed; purge any stored key on next save.
  updateData.deepgramApiKey = FieldValue.delete();

  return updateData;
}
