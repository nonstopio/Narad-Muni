import OpenAI, { AzureOpenAI } from "openai";
import type { ClaudeParseResult } from "@/types/claude";
import type { AIParseProvider, RepeatEntryInput } from "./types";
import { buildSystemPrompt, buildUserMessage, PARSE_RESULT_JSON_SCHEMA } from "./prompt";

export const DEFAULT_OPENAI_MODEL = "gpt-4o";
export const DEFAULT_AZURE_API_VERSION = "2024-08-01-preview";

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

  constructor(opts: { apiKey: string; model?: string; baseUrl?: string }) {
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseUrl || undefined,
      timeout: 60_000,
    });
    this.model = opts.model || DEFAULT_OPENAI_MODEL;
    this.name = `OpenAI (${this.model})`;
  }

  async parseTranscript(
    transcript: string,
    date: string,
    repeatEntries: RepeatEntryInput[]
  ): Promise<ClaudeParseResult> {
    const systemPrompt = buildSystemPrompt(date, repeatEntries) + JSON_INSTRUCTION;
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
  }) {
    this.client = new AzureOpenAI({
      apiKey: opts.apiKey,
      endpoint: opts.endpoint,
      deployment: opts.deployment,
      apiVersion: opts.apiVersion,
      timeout: 60_000,
    });
    this.deployment = opts.deployment;
    this.name = `Azure OpenAI (${opts.deployment})`;
  }

  async parseTranscript(
    transcript: string,
    date: string,
    repeatEntries: RepeatEntryInput[]
  ): Promise<ClaudeParseResult> {
    const systemPrompt = buildSystemPrompt(date, repeatEntries) + JSON_INSTRUCTION;
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
        response_format: { type: "json_object" },
        max_completion_tokens: 4096,
      });
    } catch (err) {
      console.error("[Narada → Azure OpenAI] API call failed:", err);
      throw err;
    }

    const content = response.choices[0]?.message?.content;
    return parseJsonOrThrow(content, "Azure OpenAI");
  }
}
