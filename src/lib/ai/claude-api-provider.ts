import Anthropic from "@anthropic-ai/sdk";
import type { ClaudeParseResult } from "@/types/claude";
import type { AIParseProvider, RepeatEntryInput } from "./types";
import { buildSystemPrompt, buildUserMessage, PARSE_RESULT_JSON_SCHEMA } from "./prompt";

export class ClaudeAPIProvider implements AIParseProvider {
  name = "Claude API (Sonnet)";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async parseTranscript(
    transcript: string,
    date: string,
    repeatEntries: RepeatEntryInput[]
  ): Promise<ClaudeParseResult> {
    const client = new Anthropic({ apiKey: this.apiKey });
    const systemPrompt = buildSystemPrompt(date, repeatEntries);

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250514",
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
      messages: [{ role: "user", content: buildUserMessage(transcript) }],
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock || toolBlock.type !== "tool_use") {
      throw new Error("Claude API did not return a tool_use block");
    }

    return toolBlock.input as ClaudeParseResult;
  }
}
