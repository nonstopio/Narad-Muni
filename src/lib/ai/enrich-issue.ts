import { spawn } from "child_process";
import type { AIProvider, KeyProvider } from "@/types";
import { buildIssueSystemPrompt, buildIssueUserMessage } from "./issue-prompt";
import { resolveProviderConfig, type AppSettings } from "./index";
import { getGlobalAIConfig } from "@/lib/global-ai-config";
import { DEFAULT_OPENAI_MODEL } from "./openai-provider";
import { GROQ_MODEL } from "./groq-provider";

export interface EnrichedIssue {
  title: string;
  body: string;
}

const KEY_PROVIDER_SET = new Set<AIProvider>([
  "claude-api",
  "gemini",
  "groq",
  "openai",
  "azure-openai",
]);

function isKeyProvider(p: AIProvider): p is KeyProvider {
  return KEY_PROVIDER_SET.has(p);
}

export async function enrichIssueDescription(
  title: string,
  description: string,
  settings?: AppSettings | null
): Promise<EnrichedIssue> {
  const provider = (settings?.aiProvider ?? "local-claude") as AIProvider;
  const systemPrompt = buildIssueSystemPrompt();
  const userMessage = buildIssueUserMessage(title, description);

  console.log(`[Narada → Issue Enrichment] Using provider: ${provider}`);

  let rawOutput: string;

  try {
    if (provider === "local-claude") {
      rawOutput = await spawnCli("claude", [
        "--print", "--no-session-persistence", "--model", "sonnet",
        "--tools", "", "--append-system-prompt", systemPrompt,
        "--max-budget-usd", "0.50",
      ], userMessage);
    } else if (provider === "local-cursor") {
      const combined = `${systemPrompt}\n\n${userMessage}`;
      rawOutput = await spawnCli("agent", ["--trust", "-p", combined]);
    } else if (isKeyProvider(provider)) {
      const global = await getGlobalAIConfig();
      const resolved = resolveProviderConfig(provider, settings ?? null, global);

      switch (resolved.kind) {
        case "claude-api": {
          const Anthropic = (await import("@anthropic-ai/sdk")).default;
          const client = new Anthropic({ apiKey: resolved.apiKey });
          const response = await client.messages.create({
            model: "claude-sonnet-4-5-20250514",
            max_tokens: 2048,
            system: systemPrompt,
            messages: [{ role: "user", content: userMessage }],
          });
          const textBlock = response.content.find((b) => b.type === "text");
          if (!textBlock || textBlock.type !== "text") {
            throw new Error("No text response from Claude API");
          }
          rawOutput = textBlock.text;
          break;
        }
        case "gemini": {
          const { GoogleGenerativeAI } = await import("@google/generative-ai");
          const genAI = new GoogleGenerativeAI(resolved.apiKey);
          const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            systemInstruction: systemPrompt,
          });
          const result = await model.generateContent(userMessage);
          rawOutput = result.response.text();
          break;
        }
        case "groq": {
          const { default: Groq } = await import("groq-sdk");
          const client = new Groq({ apiKey: resolved.apiKey, timeout: 60_000 });
          const response = await client.chat.completions.create({
            model: GROQ_MODEL,
            max_tokens: 2048,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
          });
          rawOutput = response.choices[0]?.message?.content ?? "";
          break;
        }
        case "openai": {
          const { default: OpenAI } = await import("openai");
          const client = new OpenAI({
            apiKey: resolved.apiKey,
            baseURL: resolved.baseUrl || undefined,
            timeout: 60_000,
          });
          const response = await client.chat.completions.create({
            model: resolved.model || DEFAULT_OPENAI_MODEL,
            max_completion_tokens: 2048,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
          });
          rawOutput = response.choices[0]?.message?.content ?? "";
          break;
        }
        case "azure-openai": {
          const { AzureOpenAI } = await import("openai");
          const client = new AzureOpenAI({
            apiKey: resolved.apiKey,
            endpoint: resolved.endpoint,
            deployment: resolved.deployment,
            apiVersion: resolved.apiVersion,
            timeout: 60_000,
          });
          const response = await client.chat.completions.create({
            model: resolved.deployment,
            max_completion_tokens: 2048,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
          });
          rawOutput = response.choices[0]?.message?.content ?? "";
          break;
        }
      }
    } else {
      throw new Error(`Unknown AI provider: ${provider}`);
    }
  } catch (err) {
    console.error("[Narada → Issue Enrichment] AI enrichment failed, using raw description:", err);
    return { title, body: description.trim() || "No description provided." };
  }

  return parseEnrichedOutput(rawOutput!, title);
}

function parseEnrichedOutput(raw: string, fallbackTitle: string): EnrichedIssue {
  const titleIdx = raw.indexOf("TITLE:");
  const cleaned = titleIdx >= 0 ? raw.slice(titleIdx) : raw;

  const separatorMatch = cleaned.match(/^TITLE:\s*(.+)\n---\n([\s\S]*)$/);
  if (separatorMatch) {
    return { title: separatorMatch[1].trim(), body: separatorMatch[2].trim() };
  }

  const titleLineMatch = cleaned.match(/^TITLE:\s*(.+)\n([\s\S]*)$/);
  if (titleLineMatch) {
    return { title: titleLineMatch[1].trim(), body: titleLineMatch[2].replace(/^---\s*/, "").trim() };
  }

  return { title: fallbackTitle, body: cleaned.trim() };
}

function spawnCli(command: string, args: string[], stdinContent?: string): Promise<string> {
  console.log(`[Narada] spawnCli: ${command} ${args.join(" ")}`);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let settled = false;

    const settle = (fn: () => void) => {
      if (!settled) { settled = true; fn(); }
    };

    const proc = spawn(command, args, {
      stdio: [stdinContent ? "pipe" : "ignore", "pipe", "pipe"],
    });

    proc.stdout!.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr!.on("data", (chunk: Buffer) => errChunks.push(chunk));

    proc.on("error", (err: NodeJS.ErrnoException) => {
      console.error(`[Narada] spawnCli ${command}: process error:`, err.message);
      settle(() => reject(new Error(`${command} CLI error: ${err.message}`)));
    });

    proc.on("close", (code) => {
      settle(() => {
        const out = Buffer.concat(chunks).toString("utf-8");
        const err = Buffer.concat(errChunks).toString("utf-8");
        if (code !== 0 && !out) {
          console.error(`[Narada] spawnCli ${command}: exited with code ${code}`, err.slice(0, 500));
          reject(new Error(`${command} exited with code ${code}: ${err || "unknown"}`));
          return;
        }
        resolve(out.trim());
      });
    });

    if (stdinContent && proc.stdin) {
      proc.stdin.write(stdinContent);
      proc.stdin.end();
    }

    const timer = setTimeout(() => {
      console.error(`[Narada] spawnCli ${command}: timed out after 2 minutes`);
      proc.kill("SIGTERM");
      settle(() => reject(new Error(`${command} CLI timed out after 2 minutes`)));
    }, 120_000);

    proc.on("close", () => clearTimeout(timer));
  });
}
