import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import type { ClaudeParseResult } from "@/types/claude";
import type { AIParseProvider, RepeatEntryInput } from "./types";
import { buildSystemPrompt, buildUserMessage } from "./prompt";

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    tasks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          description: { type: SchemaType.STRING },
          issueKey: { type: SchemaType.STRING },
          timeEstimate: { type: SchemaType.STRING },
        },
        required: ["description"],
      },
    },
    blockers: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
    },
    timeEntries: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          issueKey: { type: SchemaType.STRING },
          timeSpentSecs: { type: SchemaType.NUMBER },
          started: { type: SchemaType.STRING },
          comment: { type: SchemaType.STRING },
          isRepeat: { type: SchemaType.BOOLEAN },
        },
        required: ["issueKey", "timeSpentSecs", "started", "comment", "isRepeat"],
      },
    },
    tomorrowTasks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          description: { type: SchemaType.STRING },
          issueKey: { type: SchemaType.STRING },
        },
        required: ["description"],
      },
    },
    slackFormat: { type: SchemaType.STRING },
    teamsFormat: { type: SchemaType.STRING },
  },
  required: ["tasks", "blockers", "timeEntries", "tomorrowTasks", "slackFormat", "teamsFormat"],
};

export class GeminiProvider implements AIParseProvider {
  name = "Gemini 2.0 Flash";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async parseTranscript(
    transcript: string,
    date: string,
    repeatEntries: RepeatEntryInput[]
  ): Promise<ClaudeParseResult> {
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const systemPrompt = buildSystemPrompt(date, repeatEntries);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const userMessage = buildUserMessage(transcript);
    console.log(`[Narada → Gemini] Sending request — model=gemini-2.0-flash, system_prompt=${systemPrompt.length} chars, user_message=${userMessage.length} chars`);

    let result;
    try {
      result = await model.generateContent(userMessage);
    } catch (err) {
      console.error("[Narada → Gemini] API call failed:", err);
      throw err;
    }

    const text = result.response.text();
    try {
      return JSON.parse(text) as ClaudeParseResult;
    } catch (parseErr) {
      console.error("[Narada → Gemini] JSON parse failed:", parseErr, "Raw text:", text.slice(0, 500));
      throw new Error("Gemini returned invalid JSON");
    }
  }
}
