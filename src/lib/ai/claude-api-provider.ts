import Anthropic from "@anthropic-ai/sdk";
import type { ClaudeParseResult } from "@/types/claude";
import type { AIParseProvider, PromptOptions, RepeatEntryInput } from "./types";
import { buildSystemPrompt, buildUserMessage, PARSE_RESULT_JSON_SCHEMA } from "./prompt";

export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5";

export class ClaudeAPIProvider implements AIParseProvider {
  name = "Claude API (Sonnet)";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async parseTranscript(
    transcript: string,
    date: string,
    repeatEntries: RepeatEntryInput[],
    opts?: PromptOptions
  ): Promise<ClaudeParseResult> {
    const client = new Anthropic({ apiKey: this.apiKey });
    const systemPrompt = buildSystemPrompt(date, repeatEntries, opts);

    const userMessage = buildUserMessage(transcript);
    console.log(`[Narada → Claude API] Sending request — model=${DEFAULT_CLAUDE_MODEL}, max_tokens=4096, system_prompt=${systemPrompt.length} chars, user_message=${userMessage.length} chars`);

    let response;
    try {
      response = await client.messages.create({
        model: DEFAULT_CLAUDE_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        tools: [
          {
            name: "parse_result",
            description: "Output the parsed daily standup result as structured JSON",
            input_schema: PARSE_RESULT_JSON_SCHEMA as Anthropic.Tool["input_schema"],
          },
        ],
        tool_choice: { type: "tool", name: "parse_result" },
        messages: [{ role: "user", content: userMessage }],
      });
    } catch (err) {
      console.error("[Narada → Claude API] API call failed:", err);
      throw err;
    }

    console.log(`[Narada → Claude API] Response: stop_reason=${response.stop_reason} usage=${JSON.stringify(response.usage)}`);
    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new Error("Claude API did not return a tool_use block");
    }

    return toolBlock.input as ClaudeParseResult;
  }
}
