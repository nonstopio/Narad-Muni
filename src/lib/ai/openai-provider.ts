import OpenAI, { AzureOpenAI } from "openai";
import type { ClaudeParseResult } from "@/types/claude";
import type { AIParseProvider, PromptOptions, RepeatEntryInput } from "./types";
import { buildSystemPrompt, buildUserMessage, PARSE_RESULT_JSON_SCHEMA } from "./prompt";
import { DEFAULT_AI_TIMEOUT_MS } from "@/lib/ai-timeout";

export const DEFAULT_OPENAI_MODEL = "gpt-4o";
// Matches Morph, which talks to the same Azure resource. 2024-08-01-preview predates
// max_completion_tokens and newer (gpt-5) deployments, so it is treated as unset: it was
// this app's old default and got persisted into saved configs verbatim.
export const DEFAULT_AZURE_API_VERSION = "2025-01-01-preview";
const LEGACY_AZURE_API_VERSION = "2024-08-01-preview";

export function createAzureClient(opts: {
  apiKey: string;
  endpoint: string;
  deployment: string;
  apiVersion?: string | null;
  timeoutMs?: number;
}): AzureOpenAI {
  const version = (opts.apiVersion ?? "").trim();
  return new AzureOpenAI({
    apiKey: opts.apiKey.trim(),
    // Pasted endpoints often carry a trailing slash; the SDK appends "/openai" itself.
    endpoint: opts.endpoint.trim().replace(/\/+$/, ""),
    deployment: opts.deployment.trim(),
    apiVersion: !version || version === LEGACY_AZURE_API_VERSION ? DEFAULT_AZURE_API_VERSION : version,
    timeout: opts.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS,
  });
}

const JSON_INSTRUCTION = `\n\nRespond with ONLY a valid JSON object matching this schema:\n${JSON.stringify(PARSE_RESULT_JSON_SCHEMA, null, 2)}`;

function parseJsonOrThrow(content: string | null | undefined, label: string): ClaudeParseResult {
  if (!content) {
    throw new Error(`${label} returned an empty response`);
  }
  try {
    return JSON.parse(content) as ClaudeParseResult;
  } catch (parseErr) {
    console.error(`[Narada → ${label}] JSON parse failed:`, parseErr, "Raw text:", content.slice(0, 500));
    throw new Error(`${label} returned invalid JSON`);
  }
}

export class OpenAIProvider implements AIParseProvider {
  name: string;
  private client: OpenAI;
  private model: string;

  constructor(opts: { apiKey: string; model?: string; baseUrl?: string; timeoutMs?: number }) {
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseUrl || undefined,
      timeout: opts.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS,
    });
    this.model = opts.model || DEFAULT_OPENAI_MODEL;
    this.name = `OpenAI (${this.model})`;
  }

  async parseTranscript(
    transcript: string,
    date: string,
    repeatEntries: RepeatEntryInput[],
    opts?: PromptOptions
  ): Promise<ClaudeParseResult> {
    const systemPrompt = buildSystemPrompt(date, repeatEntries, opts) + JSON_INSTRUCTION;
    const userMessage = buildUserMessage(transcript);

    console.log(`[Narada → OpenAI] Sending request — model=${this.model}, system_prompt=${systemPrompt.length} chars, user_message=${userMessage.length} chars`);

    let response;
    try {
      response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 4096,
      });
    } catch (err) {
      console.error("[Narada → OpenAI] API call failed:", err);
      throw err;
    }

    const content = response.choices[0]?.message?.content;
    return parseJsonOrThrow(content, "OpenAI");
  }
}

export class AzureOpenAIProvider implements AIParseProvider {
  name: string;
  private client: AzureOpenAI;
  private deployment: string;

  constructor(opts: {
    apiKey: string;
    endpoint: string;
    deployment: string;
    apiVersion: string;
    timeoutMs?: number;
  }) {
    this.client = createAzureClient(opts);
    this.deployment = opts.deployment.trim();
    this.name = `Azure OpenAI (${opts.deployment})`;
  }

  async parseTranscript(
    transcript: string,
    date: string,
    repeatEntries: RepeatEntryInput[],
    opts?: PromptOptions
  ): Promise<ClaudeParseResult> {
    const systemPrompt = buildSystemPrompt(date, repeatEntries, opts) + JSON_INSTRUCTION;
    const userMessage = buildUserMessage(transcript);

    console.log(`[Narada → Azure OpenAI] Sending request — deployment=${this.deployment}, system_prompt=${systemPrompt.length} chars, user_message=${userMessage.length} chars`);

    let response;
    try {
      response = await this.client.chat.completions.create({
        model: this.deployment,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        // No token cap, as in Morph: reasoning deployments spend the cap on hidden reasoning
        // and come back empty, and older api-versions reject max_completion_tokens outright.
        response_format: { type: "json_object" },
      });
    } catch (err) {
      console.error("[Narada → Azure OpenAI] API call failed:", err);
      throw err;
    }

    const content = response.choices[0]?.message?.content;
    return parseJsonOrThrow(content, "Azure OpenAI");
  }
}
