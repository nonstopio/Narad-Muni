export interface AdminAnalyticsData {
  totalUsers: number;
  dau: number;
  wau: number;
  mau: number;
  rangeDays: number;

  platformAdoption: {
    platform: string;
    configured: number;
    activelyUsed: number;
  }[];

  publishStats: {
    platform: string;
    sent: number;
    failed: number;
    skipped: number;
  }[];

  aiProviderDistribution: {
    provider: string;
    count: number;
  }[];

  dailyTrend: {
    date: string;
    updateCount: number;
    uniqueUsers: number;
  }[];

  streakDistribution: {
    bucket: string;
    count: number;
  }[];

  hourlyDistribution: number[];

  /**
   * All users with their activity status within the selected range.
   * `isActive = true` means the user published at least one update in the range.
   */
  users: {
    email: string;
    lastActive: string | null;
    updateCount: number;
    isActive: boolean;
  }[];

  // --- Performance & value metrics (added in analytics v2) ---

  /** Count of updates that carry a `metrics` object (i.e. published after v2 rollout). */
  updatesWithMetrics: number;

  /** Total estimated time saved (seconds) across updates with metrics in range. */
  totalTimeSavedSecs: number;

  /** p50/p95 latency per pipeline stage, in ms. `null` when no samples. */
  stageLatency: {
    stage: "transcribe" | "deepgram" | "aiParse" | "aiProvider" | "slack" | "teams" | "jira" | "totalPublish";
    p50: number | null;
    p95: number | null;
    sampleCount: number;
  }[];

  /** Cloud AI providers (claude-api, gemini, groq), ranked by median provider latency asc. */
  cloudProviderLatency: {
    provider: string;
    p50: number | null;
    p95: number | null;
    sampleCount: number;
  }[];

  /** Local CLI providers (local-claude, local-cursor). Shown separately — hardware varies. */
  localProviderLatency: {
    provider: string;
    p50: number | null;
    p95: number | null;
    sampleCount: number;
  }[];

  /** For each update with metrics, which stage dominated wall time. */
  slowestStageDistribution: {
    stage: string;
    count: number;
  }[];
}
