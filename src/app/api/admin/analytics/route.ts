import { NextResponse, type NextRequest } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { handleAuthError } from "@/lib/auth-middleware";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import type { AdminAnalyticsData } from "@/types/admin";
import type { UpdateMetrics } from "@/types";

const LOCAL_PROVIDER_NAMES = new Set(["local-claude", "local-cursor"]);

function percentile(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return Math.round(sortedAsc[idx]);
}

function percentiles(samples: number[]): { p50: number | null; p95: number | null; sampleCount: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    sampleCount: samples.length,
  };
}

// 5-minute in-memory cache
let cache: { data: AdminAnalyticsData; expiry: number } | null = null;
let cacheRange = 0;

export async function GET(request: NextRequest) {
  try {
    await verifyAdmin(request);
  } catch (error) {
    return handleAuthError(error);
  }

  const range = parseInt(request.nextUrl.searchParams.get("range") ?? "30", 10);
  const now = Date.now();

  if (cache && cache.expiry > now && cacheRange === range) {
    return NextResponse.json(cache.data);
  }

  try {
    const data = await computeAnalytics(range);
    cache = { data, expiry: now + 5 * 60 * 1000 };
    cacheRange = range;
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Narada] Analytics computation error:", error);
    return NextResponse.json(
      { error: "Failed to compute analytics" },
      { status: 500 }
    );
  }
}

async function computeAnalytics(rangeDays: number): Promise<AdminAnalyticsData> {
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - rangeDays);
  const rangeStartStr = rangeStart.toISOString().slice(0, 10);

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);

  const monthAgo = new Date(now);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const monthAgoStr = monthAgo.toISOString().slice(0, 10);

  const todayStr = now.toISOString().slice(0, 10);

  // List all user docs
  const userDocs = await adminDb.collection("users").listDocuments();
  const totalUsers = userDocs.length;

  // Fetch all user emails from Firebase Auth
  const userEmails = new Map<string, string>();
  try {
    const identifiers = userDocs.map((d) => ({ uid: d.id }));
    // getUsers supports up to 100 at a time
    for (let i = 0; i < identifiers.length; i += 100) {
      const batch = identifiers.slice(i, i + 100);
      const result = await adminAuth.getUsers(batch);
      for (const user of result.users) {
        if (user.email) userEmails.set(user.uid, user.email);
      }
    }
  } catch {
    // Best-effort
  }

  // Parallel per-user data fetch
  const CONCURRENCY = 10;
  const perUser: {
    uid: string;
    aiProvider: string;
    configs: { platform: string; configured: boolean }[];
    updates: {
      date: string;
      createdAt: string;
      slackStatus: string;
      teamsStatus: string;
      jiraStatus: string;
      metrics: UpdateMetrics | null;
    }[];
  }[] = [];

  for (let i = 0; i < userDocs.length; i += CONCURRENCY) {
    const batch = userDocs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((doc) => fetchUserData(doc.id, rangeStartStr)));
    perUser.push(...results);
  }

  // DAU / WAU / MAU
  const dauSet = new Set<string>();
  const wauSet = new Set<string>();
  const mauSet = new Set<string>();

  // Platform publish stats
  const publishStats: Record<string, { sent: number; failed: number; skipped: number }> = {
    SLACK: { sent: 0, failed: 0, skipped: 0 },
    TEAMS: { sent: 0, failed: 0, skipped: 0 },
    JIRA: { sent: 0, failed: 0, skipped: 0 },
  };

  // Daily trend
  const dailyMap = new Map<string, { updateCount: number; users: Set<string> }>();

  // Hourly distribution
  const hourly = new Array(24).fill(0);

  // Platform adoption
  const configuredCount: Record<string, number> = { SLACK: 0, TEAMS: 0, JIRA: 0 };
  const activelyUsedCount: Record<string, number> = { SLACK: 0, TEAMS: 0, JIRA: 0 };

  // AI provider distribution
  const aiProviders = new Map<string, number>();

  // Streak tracking
  const userStreaks = new Map<string, number>();

  // Inactive users
  const lastActiveMap = new Map<string, string | null>();

  for (const user of perUser) {
    // AI provider
    aiProviders.set(user.aiProvider, (aiProviders.get(user.aiProvider) ?? 0) + 1);

    // Platform configs
    const userActivelyUsed = new Set<string>();
    for (const cfg of user.configs) {
      if (cfg.configured) {
        configuredCount[cfg.platform] = (configuredCount[cfg.platform] ?? 0) + 1;
      }
    }

    // Track last active for inactive users
    let lastActive: string | null = null;

    // Process updates
    const userDates = new Set<string>();
    for (const update of user.updates) {
      const date = update.date;
      userDates.add(date);

      if (!lastActive || date > lastActive) lastActive = date;

      // DAU/WAU/MAU
      if (date === todayStr) dauSet.add(user.uid);
      if (date >= weekAgoStr) wauSet.add(user.uid);
      if (date >= monthAgoStr) mauSet.add(user.uid);

      // Daily trend
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { updateCount: 0, users: new Set() });
      }
      const day = dailyMap.get(date)!;
      day.updateCount++;
      day.users.add(user.uid);

      // Hourly
      if (update.createdAt) {
        const hour = new Date(update.createdAt).getHours();
        if (hour >= 0 && hour < 24) hourly[hour]++;
      }

      // Publish stats
      const countStatus = (platform: string, status: string) => {
        if (status === "SENT") publishStats[platform].sent++;
        else if (status === "FAILED") publishStats[platform].failed++;
        else if (status === "SKIPPED") publishStats[platform].skipped++;
      };
      countStatus("SLACK", update.slackStatus);
      countStatus("TEAMS", update.teamsStatus);
      countStatus("JIRA", update.jiraStatus);

      // Actively used platforms
      if (update.slackStatus === "SENT") userActivelyUsed.add("SLACK");
      if (update.teamsStatus === "SENT") userActivelyUsed.add("TEAMS");
      if (update.jiraStatus === "SENT") userActivelyUsed.add("JIRA");
    }

    for (const p of userActivelyUsed) {
      activelyUsedCount[p] = (activelyUsedCount[p] ?? 0) + 1;
    }

    lastActiveMap.set(user.uid, lastActive);

    // Calculate streak
    const sortedDates = Array.from(userDates).sort().reverse();
    let streak = 0;
    let checkDate = todayStr;
    for (const d of sortedDates) {
      if (d === checkDate) {
        streak++;
        const prev = new Date(checkDate);
        prev.setDate(prev.getDate() - 1);
        checkDate = prev.toISOString().slice(0, 10);
      } else if (d < checkDate) {
        break;
      }
    }
    userStreaks.set(user.uid, streak);
  }

  // Performance metrics aggregation (only updates that carry `metrics`)
  const samples = {
    transcribe: [] as number[],
    deepgram: [] as number[],
    aiParse: [] as number[],
    aiProvider: [] as number[],
    slack: [] as number[],
    teams: [] as number[],
    jira: [] as number[],
    totalPublish: [] as number[],
  };
  const providerProviderMs = new Map<string, number[]>();
  let updatesWithMetrics = 0;
  let totalTimeSavedSecs = 0;
  const slowestStageCounts = new Map<string, number>();

  for (const user of perUser) {
    for (const update of user.updates) {
      const m = update.metrics;
      if (!m || !m.timings) continue;
      updatesWithMetrics++;
      totalTimeSavedSecs += m.estTimeSavedSecs ?? 0;

      const t = m.timings;
      const pushIf = (arr: number[], v: number | undefined) => {
        if (typeof v === "number" && v >= 0) arr.push(v);
      };
      pushIf(samples.transcribe, t.transcribeMs);
      pushIf(samples.deepgram, t.deepgramMs);
      pushIf(samples.aiParse, t.aiParseMs);
      pushIf(samples.aiProvider, t.aiProviderMs);
      pushIf(samples.slack, t.slackMs);
      pushIf(samples.teams, t.teamsMs);
      pushIf(samples.jira, t.jiraMs);
      pushIf(samples.totalPublish, t.totalPublishMs);

      if (m.aiProvider && typeof t.aiProviderMs === "number" && t.aiProviderMs >= 0) {
        const list = providerProviderMs.get(m.aiProvider) ?? [];
        list.push(t.aiProviderMs);
        providerProviderMs.set(m.aiProvider, list);
      }

      // Slowest stage (ignores totalPublish)
      const stageSamples: Array<[string, number | undefined]> = [
        ["transcribe", t.transcribeMs],
        ["aiParse", t.aiParseMs],
        ["slack", t.slackMs],
        ["teams", t.teamsMs],
        ["jira", t.jiraMs],
      ];
      let slowest: { stage: string; ms: number } | null = null;
      for (const [stage, ms] of stageSamples) {
        if (typeof ms !== "number" || ms < 0) continue;
        if (!slowest || ms > slowest.ms) slowest = { stage, ms };
      }
      if (slowest) {
        slowestStageCounts.set(slowest.stage, (slowestStageCounts.get(slowest.stage) ?? 0) + 1);
      }
    }
  }

  const stageLatency: AdminAnalyticsData["stageLatency"] = (
    ["transcribe", "deepgram", "aiParse", "aiProvider", "slack", "teams", "jira", "totalPublish"] as const
  ).map((stage) => ({ stage, ...percentiles(samples[stage]) }));

  const cloudProviderLatency: AdminAnalyticsData["cloudProviderLatency"] = [];
  const localProviderLatency: AdminAnalyticsData["localProviderLatency"] = [];
  for (const [provider, arr] of providerProviderMs.entries()) {
    const entry = { provider, ...percentiles(arr) };
    if (LOCAL_PROVIDER_NAMES.has(provider)) {
      localProviderLatency.push(entry);
    } else {
      cloudProviderLatency.push(entry);
    }
  }
  cloudProviderLatency.sort((a, b) => (a.p50 ?? Infinity) - (b.p50 ?? Infinity));
  localProviderLatency.sort((a, b) => (a.p50 ?? Infinity) - (b.p50 ?? Infinity));

  const slowestStageDistribution: AdminAnalyticsData["slowestStageDistribution"] = Array.from(
    slowestStageCounts.entries()
  )
    .map(([stage, count]) => ({ stage, count }))
    .sort((a, b) => b.count - a.count);

  // Streak distribution buckets
  const streakBuckets = { "0": 0, "1-3": 0, "4-7": 0, "8-14": 0, "15+": 0 };
  for (const s of userStreaks.values()) {
    if (s === 0) streakBuckets["0"]++;
    else if (s <= 3) streakBuckets["1-3"]++;
    else if (s <= 7) streakBuckets["4-7"]++;
    else if (s <= 14) streakBuckets["8-14"]++;
    else streakBuckets["15+"]++;
  }

  // Daily trend sorted
  const dailyTrend = Array.from(dailyMap.entries())
    .map(([date, { updateCount, users }]) => ({
      date,
      updateCount,
      uniqueUsers: users.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // For users with no updates in range, fetch their most recent update so we can
  // still show a meaningful "last active" value.
  const usersWithoutUpdatesInRange = perUser.filter((u) => u.updates.length === 0);
  for (let i = 0; i < usersWithoutUpdatesInRange.length; i += CONCURRENCY) {
    const batch = usersWithoutUpdatesInRange.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (u) => {
        const snap = await adminDb
          .collection("users")
          .doc(u.uid)
          .collection("updates")
          .orderBy("date", "desc")
          .limit(1)
          .get();
        if (!snap.empty) {
          lastActiveMap.set(u.uid, snap.docs[0].data().date ?? null);
        }
      })
    );
  }

  const users = perUser
    .map((u) => ({
      email: userEmails.get(u.uid) ?? u.uid,
      lastActive: lastActiveMap.get(u.uid) ?? null,
      updateCount: u.updates.length,
      isActive: u.updates.length > 0,
    }))
    .sort((a, b) => {
      // Active first (desc by updateCount), then inactive by lastActive desc.
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.isActive && b.isActive) return b.updateCount - a.updateCount;
      if (!a.lastActive && !b.lastActive) return 0;
      if (!a.lastActive) return 1;
      if (!b.lastActive) return -1;
      return b.lastActive.localeCompare(a.lastActive);
    });

  return {
    totalUsers,
    dau: dauSet.size,
    wau: wauSet.size,
    mau: mauSet.size,
    rangeDays,
    platformAdoption: ["SLACK", "TEAMS", "JIRA"].map((p) => ({
      platform: p,
      configured: configuredCount[p] ?? 0,
      activelyUsed: activelyUsedCount[p] ?? 0,
    })),
    publishStats: ["SLACK", "TEAMS", "JIRA"].map((p) => ({
      platform: p,
      ...publishStats[p],
    })),
    aiProviderDistribution: Array.from(aiProviders.entries()).map(([provider, count]) => ({
      provider,
      count,
    })),
    dailyTrend,
    streakDistribution: Object.entries(streakBuckets).map(([bucket, count]) => ({
      bucket,
      count,
    })),
    hourlyDistribution: hourly,
    users,
    updatesWithMetrics,
    totalTimeSavedSecs,
    stageLatency,
    cloudProviderLatency,
    localProviderLatency,
    slowestStageDistribution,
  };
}

async function fetchUserData(uid: string, rangeStartStr: string) {
  const userRef = adminDb.collection("users").doc(uid);

  const [settingsSnap, slackSnap, teamsSnap, jiraSnap, updatesSnap] = await Promise.all([
    userRef.collection("settings").doc("app").get(),
    userRef.collection("configs").doc("SLACK").get(),
    userRef.collection("configs").doc("TEAMS").get(),
    userRef.collection("configs").doc("JIRA").get(),
    userRef
      .collection("updates")
      .where("date", ">=", rangeStartStr)
      .orderBy("date", "desc")
      .get(),
  ]);

  const aiProvider = settingsSnap.exists
    ? (settingsSnap.data()?.aiProvider ?? "local-claude")
    : "local-claude";

  const configs = [
    { platform: "SLACK", configured: !!(slackSnap.exists && slackSnap.data()?.webhookUrl) },
    { platform: "TEAMS", configured: !!(teamsSnap.exists && teamsSnap.data()?.webhookUrl) },
    { platform: "JIRA", configured: !!(jiraSnap.exists && jiraSnap.data()?.baseUrl) },
  ];

  const updates = updatesSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      date: d.date ?? "",
      createdAt: d.createdAt ?? "",
      slackStatus: d.slackStatus ?? "SKIPPED",
      teamsStatus: d.teamsStatus ?? "SKIPPED",
      jiraStatus: d.jiraStatus ?? "SKIPPED",
      metrics: (d.metrics ?? null) as UpdateMetrics | null,
    };
  });

  return { uid, aiProvider, configs, updates };
}
