export type AIProvider = "gemini" | "claude-api" | "local-claude" | "local-cursor" | "groq" | "openai" | "azure-openai";

export type KeyProvider = Exclude<AIProvider, "local-claude" | "local-cursor">;

export const KEY_PROVIDERS: KeyProvider[] = ["gemini", "claude-api", "groq", "openai", "azure-openai"];

export type PublishStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

export type Platform = "SLACK" | "TEAMS" | "JIRA";

export type ModalStep = "editing" | "sharing";

export type ProcessingStage = "analyzing" | "formatting";

/** Where a draft's words came from. Missing means "manual". */
export type DraftSource = "manual" | "projects";

export interface UpdateData {
  id: string;
  createdAt: string;
  date: string;
  rawTranscript: string;
  slackOutput: string;
  teamsOutput: string;
  slackStatus: PublishStatus;
  teamsStatus: PublishStatus;
  jiraStatus: PublishStatus;
  workLogEntries: WorkLogEntryData[];
  metrics?: UpdateMetrics;
  source?: DraftSource;
}

export interface UpdateMetricsTimings {
  aiParseMs?: number;
  aiProviderMs?: number;
  slackMs?: number;
  teamsMs?: number;
  jiraMs?: number;
  totalPublishMs: number;
}

export interface UpdateMetrics {
  aiProvider: string;
  transcriptChars: number;
  transcriptWords: number;
  taskCount: number;
  blockerCount: number;
  timeEntryCount: number;
  platformsEnabled: number;
  platformsSucceeded: number;
  estTimeSavedSecs: number;
  timings: UpdateMetricsTimings;
}

/**
 * Client-side accumulator of metrics collected during the parse phase,
 * forwarded to POST /api/updates so the server can assemble the final `metrics` object.
 */
export interface UpdateMetricsHints {
  aiProvider?: string;
  transcriptChars?: number;
  taskCount?: number;
  blockerCount?: number;
  aiProviderMs?: number;
  aiParseMs?: number;
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
  slackUserToken?: string | null;
  slackChannelId?: string | null;
  slackThreadMode?: boolean;
  slackThreadMatch?: string | null;
  slackWorkflowTime?: string | null;
  isActive: boolean;
  repeatEntries: RepeatEntryData[];
}

export type BroadcastCadence = "once" | "weekly" | "monthly";

export interface BroadcastRecipient {
  id: string;
  name: string;
}

export interface BroadcastScheduledRef {
  channel: string;
  id: string;
  postAt: number;
}

export interface BroadcastTemplateData {
  id: string;
  name: string;
  body: string;
  recipients: BroadcastRecipient[];
  scheduled?: BroadcastScheduledRef[];
  updatedAt?: string;
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

// Local git projects (desktop only). Twin interfaces live in electron/projects.ts.
export interface LocalProject {
  id: string;
  name: string;
  root: string;
  commonDir: string;
  enabled: boolean;
  authorEmails: string[];
}

export interface ProjectCommit {
  projectId: string;
  projectName: string;
  hash: string;
  shortHash: string;
  subject: string;
  body: string;
  authorEmail: string;
  authorName: string;
  authorEpochMs: number;
}

export type ProjectSkipReason =
  | "missing-folder"
  | "not-a-repo"
  | "unreadable"
  | "timed-out"
  | "too-large"
  | "no-author-email";

export type ProjectCollectResult =
  | {
      ok: true;
      date: string;
      timeZone: string;
      projects: { id: string; name: string; commits: ProjectCommit[]; truncated: boolean }[];
      skipped: { id: string; name: string; reason: ProjectSkipReason }[];
    }
  | { ok: false; error: "signed-out" | "git-missing" | "no-projects" | "none-enabled" | "all-failed" | "busy" };
