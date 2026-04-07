import Groq from "groq-sdk";
import type { ClaudeParseResult } from "@/types/claude";
import type { AIParseProvider, RepeatEntryInput } from "./types";
import { buildSystemPrompt, buildUserMessage } from "./prompt";

export const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export class GroqProvider implements AIParseProvider {
  name = "Groq (Llama 4 Scout)";
  private client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey, timeout: 60_000 });
  }

  async parseTranscript(
    transcript: string,
    date: string,
    repeatEntries: RepeatEntryInput[]
  ): Promise<ClaudeParseResult> {
    const systemPrompt = buildSystemPrompt(date, repeatEntries);
    const userMessage = buildUserMessage(transcript);

    console.log(`[Narada → Groq] Sending request — model=${GROQ_MODEL}, system_prompt=${systemPrompt.length} chars, user_message=${userMessage.length} chars`);

    let response;
    try {
      response = await this.client.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
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
