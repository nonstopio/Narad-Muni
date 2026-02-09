import type { ClaudeParseResult } from "@/types/claude";

export interface RepeatEntryInput {
  ticketId: string;
  hours: number;
  startTime: string;
  comment: string;
}

export interface AIParseProvider {
  name: string;
  parseTranscript(
    transcript: string,
    date: string,
    repeatEntries: RepeatEntryInput[]
  ): Promise<ClaudeParseResult>;
}
