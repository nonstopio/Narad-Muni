export interface ClaudeTimeEntry {
  issueKey: string;
  timeSpentSecs: number;
  started: string;
  comment: string;
  isRepeat: boolean;
}

export interface ClaudeParseResult {
  tasks: {
    description: string;
    issueKey?: string;
    timeEstimate?: string;
  }[];
  blockers: string[];
  timeEntries: ClaudeTimeEntry[];
  tomorrowTasks: {
    description: string;
    issueKey?: string;
  }[];
  slackFormat: string;
  teamsFormat: string;
}

export interface ParseRequest {
  transcript: string;
  date: string;
  repeatEntries?: {
    ticketId: string;
    hours: number;
    startTime: string;
    comment: string;
  }[];
}

export interface ParseResponse {
  success: boolean;
  data?: ClaudeParseResult;
  error?: string;
}

export interface TranscribeResponse {
  success: boolean;
  transcript?: string;
  confidence?: number;
  duration?: number;
  error?: string;
}
