import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { handleAuthError } from "@/lib/auth-middleware";
import {
  GLOBAL_AI_DOC_REF,
  getGlobalAIConfig,
  invalidateGlobalAIConfig,
  maskedGlobalConfig,
  MASKED_PLACEHOLDER,
  type AzureOpenAIGlobalConfig,
  type GlobalAIProviderConfig,
  type OpenAIGlobalConfig,
  type SingleKeyGlobalConfig,
} from "@/lib/global-ai-config";

function isString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function isReplacementKey(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && !v.includes(MASKED_PLACEHOLDER);
}

interface IncomingPayload {
  claudeApi?: { apiKey?: string | null } | null;
  gemini?: { apiKey?: string | null } | null;
  groq?: { apiKey?: string | null } | null;
  openai?: { apiKey?: string | null; model?: string | null; baseUrl?: string | null } | null;
  azureOpenai?: {
    apiKey?: string | null;
    endpoint?: string | null;
    deployment?: string | null;
    apiVersion?: string | null;
  } | null;
  removeProviders?: string[];
}

export async function GET(request: NextRequest) {
  try {
    await verifyAdmin(request);
    const config = await getGlobalAIConfig();
    return NextResponse.json(maskedGlobalConfig(config));
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    const body = (await request.json()) as IncomingPayload;

    const existing = await getGlobalAIConfig();
    const next: GlobalAIProviderConfig = { ...existing };

    if (body.claudeApi !== undefined && body.claudeApi !== null) {
      const apiKey = body.claudeApi.apiKey;
      if (isReplacementKey(apiKey)) {
        next.claudeApi = { apiKey } satisfies SingleKeyGlobalConfig;
      }
    }
    if (body.gemini !== undefined && body.gemini !== null) {
      const apiKey = body.gemini.apiKey;
      if (isReplacementKey(apiKey)) {
        next.gemini = { apiKey } satisfies SingleKeyGlobalConfig;
      }
    }
    if (body.groq !== undefined && body.groq !== null) {
      const apiKey = body.groq.apiKey;
      if (isReplacementKey(apiKey)) {
        next.groq = { apiKey } satisfies SingleKeyGlobalConfig;
      }
    }
    if (body.openai !== undefined && body.openai !== null) {
      const prev = next.openai ?? null;
      const apiKey = isReplacementKey(body.openai.apiKey)
        ? body.openai.apiKey
        : prev?.apiKey;
      const model = isString(body.openai.model) ? body.openai.model : prev?.model;
      const baseUrl = isString(body.openai.baseUrl) ? body.openai.baseUrl : prev?.baseUrl;
      if (apiKey) {
        next.openai = { apiKey, model, baseUrl } satisfies OpenAIGlobalConfig;
      }
    }
    if (body.azureOpenai !== undefined && body.azureOpenai !== null) {
      const prev = next.azureOpenai ?? null;
      const apiKey = isReplacementKey(body.azureOpenai.apiKey)
        ? body.azureOpenai.apiKey
        : prev?.apiKey;
      const endpoint = isString(body.azureOpenai.endpoint)
        ? body.azureOpenai.endpoint
        : prev?.endpoint;
      const deployment = isString(body.azureOpenai.deployment)
        ? body.azureOpenai.deployment
        : prev?.deployment;
      const apiVersion = isString(body.azureOpenai.apiVersion)
        ? body.azureOpenai.apiVersion
        : prev?.apiVersion ?? "2024-08-01-preview";
      if (apiKey && endpoint && deployment && apiVersion) {
        next.azureOpenai = {
          apiKey,
          endpoint,
          deployment,
          apiVersion,
        } satisfies AzureOpenAIGlobalConfig;
      }
    }

    if (Array.isArray(body.removeProviders)) {
      for (const key of body.removeProviders) {
        if (key === "claudeApi") delete next.claudeApi;
        else if (key === "gemini") delete next.gemini;
        else if (key === "groq") delete next.groq;
        else if (key === "openai") delete next.openai;
        else if (key === "azureOpenai") delete next.azureOpenai;
      }
    }

    next.updatedAt = Date.now();
    next.updatedBy = admin.uid;

    await GLOBAL_AI_DOC_REF().set(next, { merge: false });
    invalidateGlobalAIConfig();

    return NextResponse.json(maskedGlobalConfig(next));
  } catch (error) {
    return handleAuthError(error);
  }
}
