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

    const result = await model.generateContent(buildUserMessage(transcript));
    const text = result.response.text();
    return JSON.parse(text) as ClaudeParseResult;
  }
}
