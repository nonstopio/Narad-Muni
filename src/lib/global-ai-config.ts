import { adminDb } from "./firebase-admin";
import type { KeyProvider } from "@/types";

export interface OpenAIGlobalConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export interface AzureOpenAIGlobalConfig {
  apiKey: string;
  endpoint: string;
  deployment: string;
  apiVersion: string;
}

export interface SingleKeyGlobalConfig {
  apiKey: string;
}

export interface GlobalAIProviderConfig {
  claudeApi?: SingleKeyGlobalConfig;
  gemini?: SingleKeyGlobalConfig;
  groq?: SingleKeyGlobalConfig;
  openai?: OpenAIGlobalConfig;
  azureOpenai?: AzureOpenAIGlobalConfig;
  updatedAt?: number;
  updatedBy?: string;
}

const DOC_PATH = { collection: "config", id: "aiProviderConfig" };
const CACHE_TTL_MS = 60_000;
let cache: { value: GlobalAIProviderConfig; expiry: number } | null = null;

export async function getGlobalAIConfig(): Promise<GlobalAIProviderConfig> {
  if (cache && cache.expiry > Date.now()) return cache.value;
  try {
    const doc = await adminDb.collection(DOC_PATH.collection).doc(DOC_PATH.id).get();
    const value = (doc.data() ?? {}) as GlobalAIProviderConfig;
    cache = { value, expiry: Date.now() + CACHE_TTL_MS };
    return value;
  } catch (err) {
    console.error("[Narada] getGlobalAIConfig failed:", err);
    return {};
  }
}

export function invalidateGlobalAIConfig(): void {
  cache = null;
}

export type GlobalProviderKey = "claudeApi" | "gemini" | "groq" | "openai" | "azureOpenai";

const PROVIDER_TO_GLOBAL: Record<KeyProvider, GlobalProviderKey> = {
  "claude-api": "claudeApi",
  gemini: "gemini",
  groq: "groq",
  openai: "openai",
  "azure-openai": "azureOpenai",
};

export function globalKeyFor(provider: KeyProvider): GlobalProviderKey {
  return PROVIDER_TO_GLOBAL[provider];
}

export function hasGlobalKey(
  config: GlobalAIProviderConfig,
  provider: KeyProvider
): boolean {
  const entry = config[globalKeyFor(provider)];
  if (!entry) return false;
  if (provider === "azure-openai") {
    const c = entry as AzureOpenAIGlobalConfig;
    return !!(c.apiKey && c.endpoint && c.deployment);
  }
  return !!(entry as SingleKeyGlobalConfig).apiKey;
}

export function globalKeyStatusFlags(
  config: GlobalAIProviderConfig
): Record<GlobalProviderKey, boolean> {
  return {
    claudeApi: hasGlobalKey(config, "claude-api"),
    gemini: hasGlobalKey(config, "gemini"),
    groq: hasGlobalKey(config, "groq"),
    openai: hasGlobalKey(config, "openai"),
    azureOpenai: hasGlobalKey(config, "azure-openai"),
  };
}

const MASKED = "••••••••";

function mask(value: string | undefined | null): string {
  if (!value) return "";
  if (value.length <= 8) return MASKED;
  return value.slice(0, 4) + MASKED + value.slice(-4);
}

export function maskedGlobalConfig(config: GlobalAIProviderConfig) {
  return {
    claudeApi: config.claudeApi
      ? { apiKey: mask(config.claudeApi.apiKey) }
      : null,
    gemini: config.gemini ? { apiKey: mask(config.gemini.apiKey) } : null,
    groq: config.groq ? { apiKey: mask(config.groq.apiKey) } : null,
    openai: config.openai
      ? {
          apiKey: mask(config.openai.apiKey),
          model: config.openai.model ?? "",
          baseUrl: config.openai.baseUrl ?? "",
        }
      : null,
    azureOpenai: config.azureOpenai
      ? {
          apiKey: mask(config.azureOpenai.apiKey),
          endpoint: config.azureOpenai.endpoint,
          deployment: config.azureOpenai.deployment,
          apiVersion: config.azureOpenai.apiVersion,
        }
      : null,
    has: globalKeyStatusFlags(config),
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
  };
}

export const GLOBAL_AI_DOC_REF = () =>
  adminDb.collection(DOC_PATH.collection).doc(DOC_PATH.id);

export const MASKED_PLACEHOLDER = MASKED;
