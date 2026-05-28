import type { AIParseProvider } from "./types";
import type { AIProvider, KeyProvider } from "@/types";
import { getGlobalAIConfig, type GlobalAIProviderConfig } from "@/lib/global-ai-config";
import { DEFAULT_AZURE_API_VERSION } from "./openai-provider";

export interface UseGlobalFor {
  "claude-api"?: boolean;
  gemini?: boolean;
  groq?: boolean;
  openai?: boolean;
  "azure-openai"?: boolean;
}

export interface AppSettings {
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
}

interface ClaudeResolved { kind: "claude-api"; apiKey: string }
interface GeminiResolved { kind: "gemini"; apiKey: string }
interface GroqResolved { kind: "groq"; apiKey: string }
interface OpenAIResolved {
  kind: "openai";
  apiKey: string;
  model?: string;
  baseUrl?: string;
}
interface AzureResolved {
  kind: "azure-openai";
  apiKey: string;
  endpoint: string;
  deployment: string;
  apiVersion: string;
}

export type ResolvedProviderConfig =
  | ClaudeResolved
  | GeminiResolved
  | GroqResolved
  | OpenAIResolved
  | AzureResolved;

function wantsGlobal(provider: KeyProvider, settings: AppSettings | null | undefined): boolean {
  return settings?.useGlobalFor?.[provider] === true;
}

function personalAzureComplete(s: AppSettings | null | undefined): boolean {
  return !!(s?.azureOpenaiApiKey && s.azureOpenaiEndpoint && s.azureOpenaiDeployment);
}

export function resolveProviderConfig(
  provider: KeyProvider,
  settings: AppSettings | null | undefined,
  global: GlobalAIProviderConfig
): ResolvedProviderConfig {
  const preferGlobal = wantsGlobal(provider, settings);

  const fromGlobal = (): ResolvedProviderConfig | null => {
    switch (provider) {
      case "claude-api":
        return global.claudeApi?.apiKey
          ? { kind: "claude-api", apiKey: global.claudeApi.apiKey }
          : null;
      case "gemini":
        return global.gemini?.apiKey
          ? { kind: "gemini", apiKey: global.gemini.apiKey }
          : null;
      case "groq":
        return global.groq?.apiKey
          ? { kind: "groq", apiKey: global.groq.apiKey }
          : null;
      case "openai":
        return global.openai?.apiKey
          ? {
              kind: "openai",
              apiKey: global.openai.apiKey,
              model: global.openai.model,
              baseUrl: global.openai.baseUrl,
            }
          : null;
      case "azure-openai": {
        const a = global.azureOpenai;
        if (a?.apiKey && a.endpoint && a.deployment) {
          return {
            kind: "azure-openai",
            apiKey: a.apiKey,
            endpoint: a.endpoint,
            deployment: a.deployment,
            apiVersion: a.apiVersion || DEFAULT_AZURE_API_VERSION,
          };
        }
        return null;
      }
    }
  };

  const fromPersonal = (): ResolvedProviderConfig | null => {
    switch (provider) {
      case "claude-api":
        return settings?.claudeApiKey
          ? { kind: "claude-api", apiKey: settings.claudeApiKey }
          : null;
      case "gemini":
        return settings?.geminiApiKey
          ? { kind: "gemini", apiKey: settings.geminiApiKey }
          : null;
      case "groq":
        return settings?.groqApiKey
          ? { kind: "groq", apiKey: settings.groqApiKey }
          : null;
      case "openai":
        return settings?.openaiApiKey
          ? { kind: "openai", apiKey: settings.openaiApiKey }
          : null;
      case "azure-openai":
        return personalAzureComplete(settings)
          ? {
              kind: "azure-openai",
              apiKey: settings!.azureOpenaiApiKey!,
              endpoint: settings!.azureOpenaiEndpoint!,
              deployment: settings!.azureOpenaiDeployment!,
              apiVersion: settings!.azureOpenaiApiVersion || DEFAULT_AZURE_API_VERSION,
            }
          : null;
    }
  };

  const first = preferGlobal ? fromGlobal() : fromPersonal();
  if (first) return first;
  const second = preferGlobal ? fromPersonal() : fromGlobal();
  if (second) return second;

  throw new Error(missingConfigMessage(provider));
}

function missingConfigMessage(provider: KeyProvider): string {
  switch (provider) {
    case "claude-api":
      return "Alas! The Claude gateway lies dormant — grant its key in Sacred Configurations or ask your high priest to set the global oracle.";
    case "gemini":
      return "Alas! The Gemini oracle awaits its mantra — grant its key in Sacred Configurations or ask your high priest to set the global oracle.";
    case "groq":
      return "Alas! The Groq oracle slumbers — grant its key in Sacred Configurations or ask your high priest to set the global oracle.";
    case "openai":
      return "Alas! The OpenAI oracle awaits — grant its key in Sacred Configurations or ask your high priest to set the global oracle.";
    case "azure-openai":
      return "Alas! The Azure OpenAI scrolls are incomplete — grant its endpoint, deployment, and key in Sacred Configurations or ask your high priest to set the global oracle.";
  }
}

export async function getAIProvider(settings?: AppSettings | null): Promise<AIParseProvider> {
  const provider = (settings?.aiProvider ?? "local-claude") as AIProvider;

  console.log(`[AI] Using provider: ${provider}`);

  switch (provider) {
    case "local-claude": {
      const { LocalClaudeProvider } = await import("./local-claude-provider");
      return new LocalClaudeProvider();
    }

    case "local-cursor": {
      const { LocalCursorProvider } = await import("./local-cursor-provider");
      return new LocalCursorProvider();
    }

    case "gemini":
    case "claude-api":
    case "groq":
    case "openai":
    case "azure-openai": {
      const global = await getGlobalAIConfig();
      const resolved = resolveProviderConfig(provider, settings ?? null, global);

      if (resolved.kind === "gemini") {
        const { GeminiProvider } = await import("./gemini-provider");
        return new GeminiProvider(resolved.apiKey);
      }
      if (resolved.kind === "claude-api") {
        const { ClaudeAPIProvider } = await import("./claude-api-provider");
        return new ClaudeAPIProvider(resolved.apiKey);
      }
      if (resolved.kind === "groq") {
        const { GroqProvider } = await import("./groq-provider");
        return new GroqProvider(resolved.apiKey);
      }
      if (resolved.kind === "openai") {
        const { OpenAIProvider } = await import("./openai-provider");
        return new OpenAIProvider({
          apiKey: resolved.apiKey,
          model: resolved.model,
          baseUrl: resolved.baseUrl,
        });
      }
      const { AzureOpenAIProvider } = await import("./openai-provider");
      return new AzureOpenAIProvider({
        apiKey: resolved.apiKey,
        endpoint: resolved.endpoint,
        deployment: resolved.deployment,
        apiVersion: resolved.apiVersion,
      });
    }

    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export type { AIParseProvider } from "./types";
