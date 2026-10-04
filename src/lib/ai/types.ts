import type { ClaudeParseResult } from "@/types/claude";
import type { DraftSource } from "@/types";

export interface RepeatEntryInput {
  ticketId: string;
  hours: number;
  startTime: string;
  comment: string;
}

export interface PromptOptions {
  source?: DraftSource;
}

export interface AIParseProvider {
  name: string;
  parseTranscript(
    transcript: string,
    date: string,
    repeatEntries: RepeatEntryInput[],
    opts?: PromptOptions
  ): Promise<ClaudeParseResult>;
}
