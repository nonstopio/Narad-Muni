import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { settingsDoc } from "@/lib/firestore-helpers";
import { resolveProviderConfig, type AppSettings } from "@/lib/ai";
import { getGlobalAIConfig } from "@/lib/global-ai-config";
import type { AIProvider, KeyProvider } from "@/types";

const VALID_PROVIDERS: AIProvider[] = [
  "gemini",
  "claude-api",
  "local-claude",
  "local-cursor",
  "groq",
  "openai",
  "azure-openai",
];
const CLI_TIMEOUT_MS = 15_000;
const MASKED = "••••••••";

const KEY_PROVIDERS = new Set<AIProvider>([
  "gemini",
  "claude-api",
  "groq",
  "openai",
  "azure-openai",
]);

function isKeyProvider(p: AIProvider): p is KeyProvider {
  return KEY_PROVIDERS.has(p);
}

/** Treat masked/empty values from the form as "no override". */
function pickOverride(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  if (!v) return undefined;
  if (v.includes(MASKED)) return undefined;
  return v;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    const {
      provider,
      geminiApiKey,
      claudeApiKey,
      groqApiKey,
      openaiApiKey,
      azureOpenaiApiKey,
      azureOpenaiEndpoint,
      azureOpenaiDeployment,
      azureOpenaiApiVersion,
      useGlobal,
    } = body as {
      provider: AIProvider;
      geminiApiKey?: string;
      claudeApiKey?: string;
      groqApiKey?: string;
      openaiApiKey?: string;
      azureOpenaiApiKey?: string;
      azureOpenaiEndpoint?: string;
      azureOpenaiDeployment?: string;
      azureOpenaiApiVersion?: string;
      useGlobal?: boolean;
    };

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { success: false, error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
        { status: 400 }
      );
    }

    if (provider === "local-claude") {
      await spawnTest("claude", [
        "--print", "--no-session-persistence", "--model", "sonnet",
        "--max-budget-usd", "0.01", "Say hello in one word",
      ]);
      return NextResponse.json({ success: true });
    }

    if (provider === "local-cursor") {
      await spawnTest("agent", ["--trust", "-p", "Say hello in one word"]);
      return NextResponse.json({ success: true });
    }

    if (!isKeyProvider(provider)) {
      return NextResponse.json({ success: false, error: "Unsupported provider" }, { status: 400 });
    }

    // Always start from the user's stored settings, then overlay any form
    // values the request provided. Masked / blank values from the form are
    // treated as "no override" so the stored secret is preserved.
    const snap = await settingsDoc(user.uid).get();
    const stored = (snap.data() ?? {}) as Record<string, string | undefined>;

    const settings: AppSettings = {
      geminiApiKey: pickOverride(geminiApiKey) ?? stored.geminiApiKey,
      claudeApiKey: pickOverride(claudeApiKey) ?? stored.claudeApiKey,
      groqApiKey: pickOverride(groqApiKey) ?? stored.groqApiKey,
      openaiApiKey: pickOverride(openaiApiKey) ?? stored.openaiApiKey,
      azureOpenaiApiKey: pickOverride(azureOpenaiApiKey) ?? stored.azureOpenaiApiKey,
      azureOpenaiEndpoint:
        pickOverride(azureOpenaiEndpoint) ?? stored.azureOpenaiEndpoint,
      azureOpenaiDeployment:
        pickOverride(azureOpenaiDeployment) ?? stored.azureOpenaiDeployment,
      azureOpenaiApiVersion:
        pickOverride(azureOpenaiApiVersion) ?? stored.azureOpenaiApiVersion,
    };

    if (useGlobal) {
      settings.useGlobalFor = { [provider]: true };
    }

    const global = await getGlobalAIConfig();
    const resolved = resolveProviderConfig(provider, settings, global);

    switch (resolved.kind) {
      case "gemini": {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(resolved.apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        await model.generateContent("Say hello in one word");
        break;
      }
      case "claude-api": {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic({ apiKey: resolved.apiKey });
        await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 10,
          messages: [{ role: "user", content: "Say hello in one word" }],
        });
        break;
      }
      case "groq": {
        const { default: Groq } = await import("groq-sdk");
        const { GROQ_MODEL } = await import("@/lib/ai/groq-provider");
        const client = new Groq({ apiKey: resolved.apiKey, timeout: 15_000 });
        await client.chat.completions.create({
          model: GROQ_MODEL,
          messages: [{ role: "user", content: "Say hello in one word" }],
          max_tokens: 10,
        });
        break;
      }
      case "openai": {
        const { default: OpenAI } = await import("openai");
        const { DEFAULT_OPENAI_MODEL } = await import("@/lib/ai/openai-provider");
        const client = new OpenAI({
          apiKey: resolved.apiKey,
          baseURL: resolved.baseUrl || undefined,
          timeout: 15_000,
        });
        await client.chat.completions.create({
          model: resolved.model || DEFAULT_OPENAI_MODEL,
          messages: [{ role: "user", content: "Say hello in one word" }],
          max_completion_tokens: 16,
        });
        break;
      }
      case "azure-openai": {
        const { AzureOpenAI } = await import("openai");
        const client = new AzureOpenAI({
          apiKey: resolved.apiKey,
          endpoint: resolved.endpoint,
          deployment: resolved.deployment,
          apiVersion: resolved.apiVersion,
          timeout: 15_000,
        });
        console.log(
          `[Test AI → Azure] endpoint=${resolved.endpoint} deployment=${resolved.deployment} apiVersion=${resolved.apiVersion}`
        );
        await client.chat.completions.create({
          model: resolved.deployment,
          messages: [{ role: "user", content: "Say hello in one word" }],
          max_completion_tokens: 16,
        });
        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (isAuthError(err)) return handleAuthError(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Test AI] failed:`, message);
    return NextResponse.json({ success: false, error: message });
  }
}

function spawnTest(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let settled = false;

    const settle = (fn: () => void) => {
      if (!settled) { settled = true; fn(); }
    };

    const proc = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

    proc.on("error", (err: NodeJS.ErrnoException) => {
      settle(() => {
        if (err.code === "ENOENT") {
          reject(new Error(`${command} CLI not found. Make sure it is installed and available in your PATH.`));
        } else {
          reject(new Error(`${command} CLI error: ${err.message}`));
        }
      });
    });

    proc.on("close", (code) => {
      settle(() => {
        const out = Buffer.concat(chunks).toString("utf-8");
        const err = Buffer.concat(errChunks).toString("utf-8");
        if (code !== 0 && !out) {
          reject(new Error(`${command} CLI exited with code ${code}: ${err || "unknown error"}`));
          return;
        }
        resolve(out);
      });
    });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      settle(() => reject(new Error(`${command} CLI timed out after ${CLI_TIMEOUT_MS / 1000}s`)));
    }, CLI_TIMEOUT_MS);

    proc.on("close", () => clearTimeout(timer));
  });
}
