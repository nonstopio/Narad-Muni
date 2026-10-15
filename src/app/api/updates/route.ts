import { createHash } from "node:crypto";
import { adminDb } from "@/lib/firebase-admin";
import { deliverOnce, deliveryFetch, RejectedDelivery, mergeRetryEntries, type DeliveryState, type DeliveryLedger } from "@/lib/publish-delivery";
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { updatesCol, configsCol, leavesCol, isOnLeave, LEAVE_BLOCKED } from "@/lib/firestore-helpers";
import { isDateKey, updateDateIso } from "@/lib/date-key";
import { jiraPublishBlocker } from "@/lib/jira-guard";
import { buildAdfComment } from "@/lib/jira-adf";
import { linkifyTickets } from "@/lib/linkify-tickets";
import { findWorkflowThread, postThreadReply } from "@/lib/slack-thread";
import { getTimeSavedConstants, estimateTimeSavedSecs } from "@/lib/time-saved";
import { type DocumentReference, type Query, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { UpdateMetricsHints, PublishStatus } from "@/types";
import { computeStreak, updateKeysOf } from "@/lib/streak";
import { errorMessage } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Jira worklog helpers
// ---------------------------------------------------------------------------

function toJiraUtc(started: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(
    fmt.formatToParts(started).map((x) => [x.type, x.value])
  );
  const wallInTz = new Date(
    `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`
  );
  const offsetMs = wallInTz.getTime() - started.getTime();
  const utc = new Date(started.getTime() - offsetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}` +
    `T${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())}:${pad(utc.getUTCSeconds())}.000+0000`
  );
}

function parseAsWallClock(started: string): Date {
  const m = started.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  }
  return new Date(started + "Z");
}

function secsToTimeSpent(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "0m";
}

interface WorkLogEntryDoc {
  [key: string]: unknown;
  id: string;
  issueKey: string;
  timeSpentSecs: number;
  started: string; // ISO string
  comment: string | null;
  isRepeat: boolean;
  jiraWorklogId: string | null;
}

function ledger(ref: DocumentReference, key: string, statusField?: string, generation?: string): DeliveryLedger {
  const receipt = ref.collection("deliveries").doc(generation ? `${generation}-${key}` : key);
  return {
    claim: () => adminDb.runTransaction(async (tx) => {
      const [delivery, update] = await Promise.all([tx.get(receipt), tx.get(ref)]);
      if (!update.exists) throw new Error("Update removed");
      const data = update.data()!;
      if (data.deliveryId !== generation) throw new Error("Scroll changed before delivery");
      if (statusField && (data[statusField] === "SENT" || data[statusField] === "SKIPPED")) return "SENT";
      if (statusField && data[statusField] === "UNCERTAIN") return "UNCERTAIN";
      const state = delivery.data()?.state;
      if (state === "SENT") {
        if (statusField) tx.update(ref, { [statusField]: "SENT" });
        return "SENT";
      }
      if (state === "SENDING" || state === "UNCERTAIN" || (!data.deliveryVersion && data[statusField ?? "jiraStatus"] !== "SENT")) {
        if (statusField) tx.update(ref, { [statusField]: "UNCERTAIN" });
        return "UNCERTAIN";
      }
      tx.set(receipt, { state: "SENDING", startedAt: new Date().toISOString() });
      if (statusField) tx.update(ref, { [statusField]: "PENDING" });
      return "claimed";
    }),
    finish: (state) => adminDb.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (current.data()?.deliveryId !== generation) throw new Error("Scroll changed before receipt");
      tx.set(receipt, { state, finishedAt: new Date().toISOString() }, { merge: true });
      if (statusField) tx.update(ref, { [statusField]: state });
    }),
  };
}

async function publishJiraWorklogs(
  config: { baseUrl: string; email: string; apiToken: string; timezone: string },
  entries: WorkLogEntryDoc[],
  updateRef: DocumentReference,
  generation?: string
): Promise<void> {
  const authToken = "Basic " + Buffer.from(config.email + ":" + config.apiToken).toString("base64");
  const states: DeliveryState[] = [];
  for (const entry of entries) {
    if (entry.jiraWorklogId) continue;
    const state = await deliverOnce(ledger(updateRef, `jira-${entry.id}`, undefined, generation), async () => {
      if (entry.timeSpentSecs <= 0) throw new RejectedDelivery("Jira duration must be positive");
      const res = await deliveryFetch(`${config.baseUrl.replace(/\/+$/, "")}/rest/api/3/issue/${entry.issueKey}/worklog`, {
        method: "POST",
        headers: { accept: "application/json", authorization: authToken, "content-type": "application/json", "user-agent": "NaradMuni" },
        body: JSON.stringify({ timeSpent: secsToTimeSpent(entry.timeSpentSecs), started: toJiraUtc(new Date(entry.started), config.timezone), comment: buildAdfComment(entry.comment || "") }),
      });
      const body = await res.json();
      if (!body.id) throw new Error("Jira accepted the worklog without a receipt");
      entry.jiraWorklogId = String(body.id);
      // Persist each receipt before sending another entry; quitting cannot erase successful IDs.
      await updateRef.update({ workLogEntries: entries });
    });
    states.push(state);
    if (state === "UNCERTAIN") break;
  }
  if (states.includes("UNCERTAIN")) throw new Error("Jira delivery needs confirmation");
  if (states.includes("FAILED")) throw new RejectedDelivery("Jira rejected a worklog");
}

// ---------------------------------------------------------------------------

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function hasRealBlockers(text: string, platform: "slack" | "teams"): boolean {
  const marker = platform === "slack" ? "`BLOCKER`" : "**BLOCKER**";
  const idx = text.indexOf(marker);
  if (idx === -1) return false;
  const afterMarker = text.slice(idx + marker.length);
  const nextSection = platform === "slack"
    ? afterMarker.search(/\n`(?:TODAY|TOMORROW)`/)
    : afterMarker.search(/\n\*\*(?:TODAY|TOMORROW)\*\*/);
  const blockerContent = nextSection === -1 ? afterMarker : afterMarker.slice(0, nextSection);
  const cleaned = blockerContent.replace(/[\n\r]/g, " ").replace(/[•\-–—]/g, "").trim().toLowerCase();
  if (!cleaned || cleaned === "na" || cleaned === "none" || cleaned === "n/a") return false;
  return true;
}

function buildSlackFinalText(
  text: string,
  userId?: string | null,
  date?: string,
  teamLeadId?: string | null
): string {
  let finalText = text;
  if (userId && date) {
    const displayDate = formatDateDisplay(date);
    finalText = `<@${userId}>'s Updates for \`${displayDate}\` :\n\n${text}`;
  }
  if (teamLeadId && hasRealBlockers(text, "slack")) {
    finalText += `\n\ncc <@${teamLeadId}>`;
  }
  return finalText;
}

async function sendSlackWebhook(
  webhookUrl: string,
  text: string,
  userId?: string | null,
  date?: string,
  teamLeadId?: string | null
): Promise<void> {
  const finalText = buildSlackFinalText(text, userId, date, teamLeadId);
  const res = await deliveryFetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: finalText }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack webhook failed (${res.status}): ${body}`);
  }
}

async function publishSlackViaThread(
  slackConfig: {
    slackBotToken: string;
    slackChannelId: string;
    slackThreadMatch?: string | null;
    slackWorkflowTime?: string | null;
    timezone?: string | null;
  },
  text: string,
  userId?: string | null,
  date?: string,
  teamLeadId?: string | null
): Promise<void> {
  const finalText = buildSlackFinalText(text, userId, date, teamLeadId);
  const threadTs = await findWorkflowThread(
    slackConfig.slackBotToken,
    slackConfig.slackChannelId,
    date || new Date().toISOString().split("T")[0],
    slackConfig.slackThreadMatch,
    slackConfig.slackWorkflowTime,
    slackConfig.timezone
  );
  if (!threadTs) {
    throw new RejectedDelivery("No workflow message found in the channel for the configured time window");
  }
  await postThreadReply(slackConfig.slackBotToken, slackConfig.slackChannelId, threadTs, finalText);
}

async function sendTeamsWebhook(
  webhookUrl: string,
  teamsOutput: string,
  userName?: string | null,
  userId?: string | null,
  date?: string,
  teamLeadName?: string | null,
  teamLeadId?: string | null
): Promise<void> {
  const sections = teamsOutput.split(/(?=\*\*(?:TODAY|TOMORROW|BLOCKER)\*\*)/).map((s) => s.trim()).filter(Boolean);
  const textBlocks: Array<{ type: "TextBlock"; text: string; wrap: boolean; size?: string; weight?: string; spacing?: string }> = [];
  const entities: Array<{ type: string; text: string; mentioned: { id: string; name: string } }> = [];

  if (userName && userId && date) {
    const displayDate = formatDateDisplay(date);
    textBlocks.push({
      type: "TextBlock",
      text: `<at>${userName}</at>'s Updates for \`${displayDate}\``,
      wrap: true,
      size: "Medium",
      weight: "Bolder",
    });
    entities.push({
      type: "mention",
      text: `<at>${userName}</at>`,
      mentioned: { id: userId, name: userName },
    });
  }

  sections.forEach((section, i) => {
    textBlocks.push({
      type: "TextBlock",
      text: section,
      wrap: true,
      ...(textBlocks.length > 0 || i > 0 ? { spacing: "Medium" } : {}),
    });
  });

  if (teamLeadName && teamLeadId && hasRealBlockers(teamsOutput, "teams")) {
    textBlocks.push({ type: "TextBlock", text: `cc <at>${teamLeadName}</at>`, wrap: true, spacing: "Medium" });
    entities.push({ type: "mention", text: `<at>${teamLeadName}</at>`, mentioned: { id: teamLeadId, name: teamLeadName } });
  }

  const cardContent: Record<string, unknown> = { type: "AdaptiveCard", version: "1.4", body: textBlocks };
  if (entities.length > 0) cardContent.msteams = { entities };

  const res = await deliveryFetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cardContent),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Teams webhook failed (${res.status}): ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] DELETE /api/updates uid=${user.uid}`);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing id parameter" }, { status: 400 });
    }

    const ref = updatesCol(user.uid).doc(id);
    const erased = await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const data = doc.data();
      if (data && [data.slackStatus, data.teamsStatus, data.jiraStatus].some((status) => status === "PENDING" || status === "UNCERTAIN")) return false;
      tx.delete(ref);
      return true;
    });
    if (!erased) return NextResponse.json({ success: false, error: "Alas! I cannot erase a scroll while a world has not confirmed delivery." }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada] DELETE /api/updates error:", error);
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Failed to delete update") },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] GET /api/updates uid=${user.uid}`);
    const { searchParams } = new URL(request.url);

    if (searchParams.has("dashboard")) {
      const month = searchParams.get("month") ?? "";
      const today = searchParams.get("today");
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !isDateKey(today)) {
        return NextResponse.json({ error: "Invalid calendar date" }, { status: 400 });
      }
      const [year, m] = month.split("-").map(Number);
      const [monthSnap, dateSnap, leaveSnap] = await Promise.all([
        updatesCol(user.uid).where("date", ">=", new Date(Date.UTC(year, m - 1, 1)).toISOString())
          .where("date", "<", new Date(Date.UTC(year, m, 1)).toISOString()).orderBy("date", "desc").get(),
        updatesCol(user.uid).select("date").get(),
        leavesCol(user.uid).select("kind").get(),
      ]);
      const leaves = leaveSnap.docs.map((d) => d.id);
      return NextResponse.json({
        updates: monthSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        leaves: leaves.filter((k) => k.startsWith(month)),
        holidays: leaveSnap.docs.filter((d) => d.id.startsWith(month) && d.data().kind === "holiday").map((d) => d.id),
        streak: computeStreak(updateKeysOf(dateSnap.docs.map((d) => ({ date: d.data().date }))), new Set(leaves), today),
      });
    }

    // Single update by ID
    const id = searchParams.get("id");
    if (id) {
      const doc = await updatesCol(user.uid).doc(id).get();
      if (!doc.exists) {
        return NextResponse.json({ success: false, error: "Update not found" }, { status: 404 });
      }
      return NextResponse.json({ update: { id: doc.id, ...doc.data() } });
    }

    // Most recent *non-empty* update strictly before a given day — for
    // "fetch from last update". Walks back past empty days (weekends, leave,
    // or blank entries) to the last day that actually has content to reuse.
    const latest = searchParams.get("latest");
    if (latest) {
      const before = searchParams.get("before"); // YYYY-MM-DD
      let latestQuery: Query = updatesCol(user.uid).orderBy("date", "desc");
      if (before) {
        const beforeIso = new Date(`${before}T00:00:00.000Z`).toISOString();
        latestQuery = updatesCol(user.uid)
          .where("date", "<", beforeIso)
          .orderBy("date", "desc");
      }
      // Scan recent updates newest-first; return the first with reusable
      // content — either written words or logged work.
      const snap = await latestQuery.limit(60).get();
      const doc = snap.docs.find((d: QueryDocumentSnapshot) => {
        const data = d.data();
        const hasText = typeof data.rawTranscript === "string" && data.rawTranscript.trim().length > 0;
        const hasLogs = Array.isArray(data.workLogEntries) && data.workLogEntries.length > 0;
        return hasText || hasLogs;
      });
      return NextResponse.json({ update: doc ? { id: doc.id, ...doc.data() } : null });
    }

    // List updates by month
    const month = searchParams.get("month");
    let query: Query = updatesCol(user.uid).orderBy("date", "desc");

    if (month) {
      const [year, m] = month.split("-").map(Number);
      const startOfMonth = new Date(Date.UTC(year, m - 1, 1)).toISOString();
      const endOfMonth = new Date(Date.UTC(year, m, 0, 23, 59, 59, 999)).toISOString();
      query = updatesCol(user.uid)
        .where("date", ">=", startOfMonth)
        .where("date", "<=", endOfMonth)
        .orderBy("date", "desc");
    }

    const snapshot = await query.get();
    const updates = snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ updates });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("GET updates error:", error);
    return NextResponse.json({ updates: [] }, { status: 500 });
  }
}

interface StoredUpdate {
  [key: string]: unknown;
  date: string;
  rawTranscript: string;
  slackOutput: string;
  teamsOutput: string;
  slackStatus: PublishStatus;
  teamsStatus: PublishStatus;
  jiraStatus: PublishStatus;
  workLogEntries: WorkLogEntryDoc[];
  deliveryVersion?: number;
  deliveryId?: string;
}

/** Stable content identity excludes generated IDs and delivery receipts. */
function publishIdentity(update: StoredUpdate): string {
  return createHash("sha256").update(JSON.stringify({
    raw: update.rawTranscript, slack: update.slackOutput, teams: update.teamsOutput,
    source: update.source || "manual",
    enabled: [update.slackStatus, update.teamsStatus, update.jiraStatus].map(s => s !== "SKIPPED"),
    entries: (update.workLogEntries || []).map(e => ({ issueKey: e.issueKey, timeSpentSecs: e.timeSpentSecs,
      started: parseAsWallClock(e.started).toISOString(), comment: e.comment || "", isRepeat: !!e.isRepeat })),
  })).digest("hex");
}

async function publishUpdate(uid: string, ref: DocumentReference, update: StoredUpdate, enabled: { slack: boolean; teams: boolean; jira: boolean }) {
  // Read once. Independent platform delivery jobs start together.
  const snap = await configsCol(uid).get();
  const configs = Object.fromEntries(snap.docs.map((doc) => [doc.id, doc.data()]));
  const jiraBaseUrl = configs.JIRA?.baseUrl?.trim();
  const date = update.date.split("T")[0];
  const timings: Record<string, number> = {};
  await Promise.all((["slack", "teams", "jira"] as const).map(async (platform) => {
    const field = `${platform}Status`;
    if (!enabled[platform] || update[field] === "SENT" || update[field] === "SKIPPED") return;
    const start = Date.now();
    await deliverOnce(ledger(ref, platform, field, update.deliveryId), async () => {
      // A concurrent retry may have edited a confirmed failure before this claim won.
      const latest = (await ref.get()).data() as StoredUpdate;
      const config = configs[platform.toUpperCase()];
      if (!config?.isActive) throw new RejectedDelivery(`Alas! The ${platform} portal is closed.`);
      if (platform === "slack") {
        const text = jiraBaseUrl ? linkifyTickets(latest.slackOutput, jiraBaseUrl, "slack") : latest.slackOutput;
        if (!text.trim()) throw new RejectedDelivery("Slack scroll is empty");
        if (config.slackThreadMode && config.slackBotToken && config.slackChannelId) {
          await publishSlackViaThread(config as Parameters<typeof publishSlackViaThread>[0], text, config.userId, date, config.teamLeadId);
        } else if (config.webhookUrl) {
          await sendSlackWebhook(config.webhookUrl, text, config.userId, date, config.teamLeadId);
        } else throw new RejectedDelivery("Slack portal is not configured");
      } else if (platform === "teams") {
        if (!config.webhookUrl || !latest.teamsOutput.trim()) throw new RejectedDelivery("Teams portal or scroll is empty");
        const text = jiraBaseUrl ? linkifyTickets(latest.teamsOutput, jiraBaseUrl, "teams") : latest.teamsOutput;
        await sendTeamsWebhook(config.webhookUrl, text, config.userName, config.userId, date, config.teamLeadName, config.teamLeadId);
      } else {
        if (!config.baseUrl || !config.email || !config.apiToken) throw new RejectedDelivery("Jira portal is not configured");
        await publishJiraWorklogs({ baseUrl: config.baseUrl, email: config.email, apiToken: config.apiToken, timezone: config.timezone || "Asia/Kolkata" }, latest.workLogEntries, ref, latest.deliveryId);
      }
    });
    timings[`${platform}Ms`] = Date.now() - start;
  }));
  return timings;
}

export async function POST(request: NextRequest) {
  const routeStart = Date.now();
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    const { date, rawTranscript, slackOutput, teamsOutput, workLogEntries, slackEnabled, teamsEnabled, jiraEnabled, metricsHints, source } = body;
    if (!isDateKey(date) || typeof rawTranscript !== "string") return NextResponse.json({ success: false, error: "Alas! That scroll has no valid day or words." }, { status: 400 });
    if (await isOnLeave(user.uid, date)) return NextResponse.json({ success: false, error: LEAVE_BLOCKED }, { status: 409 });
    const jiraBlocker = jiraEnabled ? jiraPublishBlocker(workLogEntries || []) : null;
    if (jiraBlocker) return NextResponse.json({ success: false, error: jiraBlocker }, { status: 400 });
    const entries: WorkLogEntryDoc[] = (workLogEntries || []).map((entry: WorkLogEntryDoc) => ({
      id: crypto.randomUUID(), issueKey: entry.issueKey, timeSpentSecs: entry.timeSpentSecs,
      started: parseAsWallClock(entry.started).toISOString(), comment: entry.comment || "", isRepeat: entry.isRepeat || false, jiraWorklogId: null,
    }));
    const data: StoredUpdate = {
      createdAt: new Date().toISOString(), date: updateDateIso(date), rawTranscript,
      slackOutput: slackOutput || "", teamsOutput: teamsOutput || "",
      slackStatus: slackEnabled ? "PENDING" : "SKIPPED", teamsStatus: teamsEnabled ? "PENDING" : "SKIPPED", jiraStatus: jiraEnabled ? "PENDING" : "SKIPPED",
      workLogEntries: entries, source: source === "projects" ? "projects" : "manual", deliveryVersion: 1, deliveryId: crypto.randomUUID(),
    };
    data.publishIdentity = publishIdentity(data);
    // One update per day; only the same content is an idempotent replay.
    const ref = updatesCol(user.uid).doc(date);
    const created = await adminDb.runTransaction(async (tx) => {
      const [current, legacy] = await Promise.all([
        tx.get(ref), tx.get(updatesCol(user.uid).where("date", "==", data.date).limit(1)),
      ]);
      if (current.exists) return { existing: { id: current.id, ...current.data() } };
      if (!legacy.empty) return { existing: { id: legacy.docs[0].id, ...legacy.docs[0].data() } };
      tx.create(ref, data);
      return { existing: null };
    });
    if (created.existing) {
      const existing = created.existing as unknown as StoredUpdate;
      if ((existing.publishIdentity || publishIdentity(existing)) !== data.publishIdentity) {
        return NextResponse.json({ success: false, error: "This day already has a different published update. Your new draft is still saved. Open history to review or retry the existing update." }, { status: 409 });
      }
      return NextResponse.json({ success: true, update: created.existing, existing: true });
    }
    const timings = await publishUpdate(user.uid, ref, data, { slack: !!slackEnabled, teams: !!teamsEnabled, jira: !!jiraEnabled });
    const result = (await ref.get()).data() as StoredUpdate;
    const platformsSucceeded = [result.slackStatus, result.teamsStatus, result.jiraStatus].filter((s) => s === "SENT").length;
    const hints: UpdateMetricsHints = metricsHints ?? {};
    const totalPublishMs = Date.now() - routeStart;
    const estTimeSavedSecs = estimateTimeSavedSecs({ platformsSucceeded, taskCount: hints.taskCount ?? 0, timeEntryCount: entries.length, toolTimeSecs: totalPublishMs / 1000 }, await getTimeSavedConstants());
    const metrics = {
      aiProvider: hints.aiProvider ?? "unknown", transcriptChars: hints.transcriptChars ?? rawTranscript.length,
      transcriptWords: rawTranscript.trim() ? rawTranscript.trim().split(/\s+/).length : 0,
      taskCount: hints.taskCount ?? 0, blockerCount: hints.blockerCount ?? 0, timeEntryCount: entries.length,
      platformsEnabled: [slackEnabled, teamsEnabled, jiraEnabled].filter(Boolean).length, platformsSucceeded, estTimeSavedSecs,
      timings: { aiParseMs: hints.aiParseMs, aiProviderMs: hints.aiProviderMs, ...timings, totalPublishMs },
    };
    await ref.update({ metrics });
    return NextResponse.json({ success: true, update: { id: ref.id, ...result, metrics }, _timings: { ...timings, totalPublishMs, platformsSucceeded, estTimeSavedSecs } });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada] Publish error:", error);
    return NextResponse.json({ success: false, error: errorMessage(error, "Alas! I could not finish dispatching this scroll.") }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    const { updateId, retrySlack, retryTeams, retryJira } = body;
    if (typeof updateId !== "string" || !updateId || updateId.includes("/")) return NextResponse.json({ success: false, error: "Invalid scroll ID" }, { status: 400 });
    const ref = updatesCol(user.uid).doc(updateId);
    // Retry edits and the send claim use the same durable parent; never trust client SENT flags.
    const data = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new RejectedDelivery("Alas! This scroll could not be found.");
      const current = snap.data() as StoredUpdate;
      const patch: Record<string, unknown> = {};
      // Only confirmed failures are editable. In-flight and uncertain payloads remain frozen.
      if (retrySlack && current.slackStatus === "FAILED" && typeof body.slackOutput === "string") patch.slackOutput = body.slackOutput;
      if (retryTeams && current.teamsStatus === "FAILED" && typeof body.teamsOutput === "string") patch.teamsOutput = body.teamsOutput;
      if (retryJira && current.jiraStatus === "FAILED" && Array.isArray(body.workLogEntries)) {
        const entries = mergeRetryEntries(current.workLogEntries, body.workLogEntries);
        const blocker = jiraPublishBlocker(entries);
        if (blocker) throw new RejectedDelivery(blocker);
        patch.workLogEntries = entries.map((entry) => entry.jiraWorklogId ? entry : { ...entry, started: parseAsWallClock(entry.started).toISOString() });
      }
      if (Object.keys(patch).length) tx.update(ref, patch);
      return { ...current, ...patch } as StoredUpdate;
    });
    if (await isOnLeave(user.uid, data.date.split("T")[0])) return NextResponse.json({ success: false, error: LEAVE_BLOCKED }, { status: 409 });
    await publishUpdate(user.uid, ref, data, { slack: !!retrySlack, teams: !!retryTeams, jira: !!retryJira });
    const final = await ref.get();
    return NextResponse.json({ success: true, update: { id: final.id, ...final.data() } });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada] Retry error:", error);
    return NextResponse.json({ success: false, error: errorMessage(error, "Alas! I could not retry this scroll.") }, { status: error instanceof RejectedDelivery ? 400 : 500 });
  }
}
