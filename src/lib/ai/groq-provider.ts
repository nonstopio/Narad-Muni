import Groq from "groq-sdk";
import type { ClaudeParseResult } from "@/types/claude";
import type { AIParseProvider, RepeatEntryInput } from "./types";
import { buildSystemPrompt, buildUserMessage, PARSE_RESULT_JSON_SCHEMA } from "./prompt";

export class GroqProvider implements AIParseProvider {
  name = "Groq (Llama 4)";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async parseTranscript(
    transcript: string,
    date: string,
    repeatEntries: RepeatEntryInput[]
  ): Promise<ClaudeParseResult> {
    const client = new Groq({ apiKey: this.apiKey, timeout: 60_000 });
    const systemPrompt = buildSystemPrompt(date, repeatEntries);
    const userMessage = buildUserMessage(transcript);

    console.log(`[Narada → Groq] Sending request — model=meta-llama/llama-4-maverick-17b-128e-instruct, system_prompt=${systemPrompt.length} chars, user_message=${userMessage.length} chars`);

    let response;
    try {
      response = await client.chat.completions.create({
        model: "meta-llama/llama-4-maverick-17b-128e-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "parse_result",
            schema: PARSE_RESULT_JSON_SCHEMA,
            strict: true,
          },
        },
        temperature: 0.3,
      });
    } catch (err) {
      console.error("[Narada → Groq] API call failed:", err);
      throw err;
    }

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Groq returned an empty response");
    }

    try {
      return JSON.parse(content) as ClaudeParseResult;
    } catch (parseErr) {
      console.error("[Narada → Groq] JSON parse failed:", parseErr, "Raw text:", content.slice(0, 500));
      throw new Error("Groq returned invalid JSON");
    }
  }
}
