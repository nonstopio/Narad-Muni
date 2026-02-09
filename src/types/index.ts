export type AIProvider = "gemini" | "claude-api" | "local-claude";

export type PublishStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

export type Platform = "SLACK" | "TEAMS" | "JIRA";

export type ModalStep = "input" | "processing" | "preview" | "success";

export type ProcessingStage = "transcribing" | "analyzing" | "formatting";

export interface UpdateData {
  id: string;
  createdAt: string;
  date: string;
  rawTranscript: string;
  audioPath?: string | null;
  slackOutput: string;
  teamsOutput: string;
  slackStatus: PublishStatus;
  teamsStatus: PublishStatus;
  jiraStatus: PublishStatus;
  workLogEntries: WorkLogEntryData[];
}

export interface WorkLogEntryData {
  id?: string;
  issueKey: string;
  timeSpentSecs: number;
  started: string;
  comment?: string;
  isRepeat: boolean;
  jiraWorklogId?: string | null;
}

export interface PlatformConfigData {
  id: string;
  platform: Platform;
  name: string;
  webhookUrl?: string | null;
  messageTemplate?: string | null;
  apiToken?: string | null;
  baseUrl?: string | null;
  email?: string | null;
  projectKey?: string | null;
  timezone?: string | null;
  isActive: boolean;
  repeatEntries: RepeatEntryData[];
}

export interface RepeatEntryData {
  id?: string;
  ticketId: string;
  hours: number;
  startTime: string;
  comment: string;
}

export interface StatData {
  label: string;
  value: string | number;
  icon: string;
  color: "blue" | "violet" | "emerald" | "amber";
}
