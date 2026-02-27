export type AIProvider = "gemini" | "claude-api" | "local-claude" | "local-cursor";

export type PublishStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

export type Platform = "SLACK" | "TEAMS" | "JIRA";

export type ModalStep = "editing" | "sharing";

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
  userName?: string | null;
  userId?: string | null;
  webhookUrl?: string | null;
  apiToken?: string | null;
  baseUrl?: string | null;
  email?: string | null;
  projectKey?: string | null;
  timezone?: string | null;
  teamLeadName?: string | null;
  teamLeadId?: string | null;
  slackBotToken?: string | null;
  slackChannelId?: string | null;
  slackThreadMode?: boolean;
  slackThreadMatch?: string | null;
  slackWorkflowTime?: string | null;
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

export type CombinedStatus = "all-success" | "partial" | "all-failed";

export function computeCombinedStatus(
  slackStatus: PublishStatus,
  teamsStatus: PublishStatus,
  jiraStatus: PublishStatus
): CombinedStatus {
  const enabled = [slackStatus, teamsStatus, jiraStatus].filter(
    (s) => s !== "SKIPPED"
  );
  if (enabled.length === 0) return "all-success";
  const failedCount = enabled.filter((s) => s === "FAILED").length;
  if (failedCount === 0) return "all-success";
  if (failedCount === enabled.length) return "all-failed";
  return "partial";
}
