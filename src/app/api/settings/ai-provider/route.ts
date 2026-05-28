import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { settingsDoc } from "@/lib/firestore-helpers";
import type { AIProvider, KeyProvider } from "@/types";
import type { UseGlobalFor } from "@/lib/ai";

const VALID_PROVIDERS: AIProvider[] = [
  "gemini",
  "claude-api",
  "local-claude",
  "local-cursor",
  "groq",
  "openai",
  "azure-openai",
];
const MASKED = "••••••••";

function maskKey(key: string | null | undefined): string {
  if (!key) return "";
  if (key.length <= 8) return MASKED;
  return key.slice(0, 4) + MASKED + key.slice(-4);
}

interface StoredSettings {
  aiProvider?: string;
  geminiApiKey?: string | null;
  claudeApiKey?: string | null;
  deepgramApiKey?: string | null;
  groqApiKey?: string | null;
  openaiApiKey?: string | null;
  azureOpenaiApiKey?: string | null;
  azureOpenaiEndpoint?: string | null;
  azureOpenaiDeployment?: string | null;
  azureOpenaiApiVersion?: string | null;
  useGlobalFor?: UseGlobalFor;
}

const REMOVABLE_FIELDS = [
  "geminiApiKey",
  "claudeApiKey",
  "deepgramApiKey",
  "groqApiKey",
  "openaiApiKey",
  "azureOpenaiApiKey",
  "azureOpenaiEndpoint",
  "azureOpenaiDeployment",
  "azureOpenaiApiVersion",
] as const;

function normalizeUseGlobalFor(input: unknown): UseGlobalFor | undefined {
  if (!input || typeof input !== "object") return undefined;
  const src = input as Record<string, unknown>;
  const keys: KeyProvider[] = ["claude-api", "gemini", "groq", "openai", "azure-openai"];
  const out: UseGlobalFor = {};
  for (const k of keys) {
    if (typeof src[k] === "boolean") out[k] = src[k] as boolean;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function buildSettingsResponse(settings: StoredSettings | undefined) {
  const useGlobalFor: UseGlobalFor = settings?.useGlobalFor ?? {};
  return {
    aiProvider: settings?.aiProvider ?? "local-claude",
    geminiApiKey: maskKey(settings?.geminiApiKey),
    claudeApiKey: maskKey(settings?.claudeApiKey),
    deepgramApiKey: maskKey(settings?.deepgramApiKey),
    groqApiKey: maskKey(settings?.groqApiKey),
    openaiApiKey: maskKey(settings?.openaiApiKey),
    azureOpenaiApiKey: maskKey(settings?.azureOpenaiApiKey),
    azureOpenaiEndpoint: settings?.azureOpenaiEndpoint ?? "",
    azureOpenaiDeployment: settings?.azureOpenaiDeployment ?? "",
    azureOpenaiApiVersion: settings?.azureOpenaiApiVersion ?? "",
    hasGeminiKey: !!settings?.geminiApiKey,
    hasClaudeKey: !!settings?.claudeApiKey,
    hasDeepgramKey: !!settings?.deepgramApiKey,
    hasGroqKey: !!settings?.groqApiKey,
    hasOpenaiKey: !!settings?.openaiApiKey,
    hasAzureOpenaiKey: !!settings?.azureOpenaiApiKey,
    hasAzureOpenaiEndpoint: !!settings?.azureOpenaiEndpoint,
    hasAzureOpenaiDeployment: !!settings?.azureOpenaiDeployment,
    useGlobalFor,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] GET /api/settings/ai-provider uid=${user.uid}`);
    const doc = await settingsDoc(user.uid).get();
    return NextResponse.json(buildSettingsResponse(doc.data() as StoredSettings | undefined));
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API AI Provider] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
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

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] PUT /api/settings/ai-provider uid=${user.uid}`);
    const body = await request.json();
    const {
      aiProvider,
      geminiApiKey,
      claudeApiKey,
      deepgramApiKey,
      groqApiKey,
      openaiApiKey,
      azureOpenaiApiKey,
      azureOpenaiEndpoint,
      azureOpenaiDeployment,
      azureOpenaiApiVersion,
      useGlobalFor,
      removeKeys,
    } = body;

    if (aiProvider && !VALID_PROVIDERS.includes(aiProvider)) {
      return NextResponse.json(
        { error: `Invalid AI provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (aiProvider) updateData.aiProvider = aiProvider;

    applyKeyField(updateData, "geminiApiKey", geminiApiKey);
    applyKeyField(updateData, "claudeApiKey", claudeApiKey);
    applyKeyField(updateData, "deepgramApiKey", deepgramApiKey);
    applyKeyField(updateData, "groqApiKey", groqApiKey);
    applyKeyField(updateData, "openaiApiKey", openaiApiKey);
    applyKeyField(updateData, "azureOpenaiApiKey", azureOpenaiApiKey);

    applyPlainField(updateData, "azureOpenaiEndpoint", azureOpenaiEndpoint);
    applyPlainField(updateData, "azureOpenaiDeployment", azureOpenaiDeployment);
    applyPlainField(updateData, "azureOpenaiApiVersion", azureOpenaiApiVersion);

    const normalizedUseGlobalFor = normalizeUseGlobalFor(useGlobalFor);
    if (normalizedUseGlobalFor) {
      const existingDoc = await settingsDoc(user.uid).get();
      const existing = (existingDoc.data() as StoredSettings | undefined)?.useGlobalFor ?? {};
      updateData.useGlobalFor = { ...existing, ...normalizedUseGlobalFor };
    }

    const keysToRemove: string[] = Array.isArray(removeKeys) ? removeKeys : [];
    for (const key of keysToRemove) {
      if ((REMOVABLE_FIELDS as readonly string[]).includes(key)) {
        updateData[key] = null;
      }
    }

    const ref = settingsDoc(user.uid);
    await ref.set(updateData, { merge: true });

    const doc = await ref.get();
    return NextResponse.json(buildSettingsResponse(doc.data() as StoredSettings | undefined));
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API AI Provider] PUT failed:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
