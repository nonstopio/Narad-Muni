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
  // Day total in seconds for manual drafts (default 8h).
  targetSecs?: number;
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
