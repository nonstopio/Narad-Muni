import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { updatesCol, configsCol } from "@/lib/firestore-helpers";
import { linkifyTickets } from "@/lib/linkify-tickets";
import { findWorkflowThread, postThreadReply } from "@/lib/slack-thread";
import { type DocumentReference, type Query, type QueryDocumentSnapshot } from "firebase-admin/firestore";

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

function buildAdfComment(text: string) {
  return {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

function isTransientError(status: number): boolean {
  return status === 429 || status >= 500;
}

const JIRA_MAX_RETRIES = 3;
const JIRA_RETRY_DELAY_MS = 5000;
const JIRA_INTER_REQUEST_DELAY_MS = 2000;

interface WorkLogEntryDoc {
  id: string;
  issueKey: string;
  timeSpentSecs: number;
  started: string; // ISO string
  comment: string | null;
  isRepeat: boolean;
  jiraWorklogId: string | null;
}

async function publishJiraWorklogs(
  config: { baseUrl: string; email: string; apiToken: string; timezone: string },
  entries: WorkLogEntryDoc[],
  updateRef: DocumentReference
): Promise<void> {
  const authToken = "Basic " + Buffer.from(config.email + ":" + config.apiToken).toString("base64");
  const total = entries.length;
  let succeeded = 0;
  const failedKeys: string[] = [];

  console.log(`[Narada] Jira worklogs: publishing ${total} entries`);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const idx = `[${i + 1}/${total}]`;

    // Skip entries already posted (from retry flows)
    if (entry.jiraWorklogId) {
      succeeded++;
      continue;
    }

    if (entry.timeSpentSecs <= 0) {
      console.warn(`[Narada] ${idx} Skipping ${entry.issueKey} — timeSpentSecs is ${entry.timeSpentSecs}`);
      failedKeys.push(`${entry.issueKey} (skipped: 0s)`);
      continue;
    }

    const started = new Date(entry.started);
    const startedUtc = toJiraUtc(started, config.timezone);
    const timeSpent = secsToTimeSpent(entry.timeSpentSecs);
    const payload = {
      timeSpent,
      started: startedUtc,
      comment: buildAdfComment(entry.comment || ""),
    };

    const url = `${config.baseUrl.replace(/\/+$/, "")}/rest/api/3/issue/${entry.issueKey}/worklog`;
    console.log(`[Narada] ${idx} ${entry.issueKey} — POST ${url} | timeSpent=${timeSpent} started=${startedUtc}`);

    let entrySucceeded = false;

    for (let attempt = 1; attempt <= JIRA_MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            accept: "application/json",
            authorization: authToken,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const body = await res.json();
          entry.jiraWorklogId = body.id?.toString() ?? null;
          console.log(`[Narada] ${idx} ${entry.issueKey} — success (worklogId=${body.id})`);
          entrySucceeded = true;
          break;
        }

        const errBody = await res.text();
        if (isTransientError(res.status) && attempt < JIRA_MAX_RETRIES) {
          console.warn(`[Narada] ${idx} ${entry.issueKey} — transient error (${res.status}), retrying...`);
          await new Promise((r) => setTimeout(r, JIRA_RETRY_DELAY_MS));
          continue;
        }
        console.error(`[Narada] ${idx} ${entry.issueKey} — failed (${res.status}): ${errBody}`);
        break;
      } catch (err) {
        if (attempt < JIRA_MAX_RETRIES) {
          console.warn(`[Narada] ${idx} ${entry.issueKey} — network error, retrying:`, err);
          await new Promise((r) => setTimeout(r, JIRA_RETRY_DELAY_MS));
          continue;
        }
        console.error(`[Narada] ${idx} ${entry.issueKey} — network error (giving up):`, err);
        break;
      }
    }

    if (entrySucceeded) {
      succeeded++;
    } else {
      failedKeys.push(entry.issueKey);
    }

    if (i < entries.length - 1) {
      await new Promise((r) => setTimeout(r, JIRA_INTER_REQUEST_DELAY_MS));
    }
  }

  const allSucceeded = failedKeys.length === 0;
  console.log(`[Narada] Jira worklogs: ${succeeded}/${total} succeeded`);
  // Single write at the end with all updated worklog IDs + final status
  await updateRef.update({
    workLogEntries: entries,
    jiraStatus: allSucceeded ? "SENT" : "FAILED",
  });
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
  const res = await fetch(webhookUrl, {
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
    throw new Error("No workflow message found in the channel for the configured time window");
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

  const res = await fetch(webhookUrl, {
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing id parameter" }, { status: 400 });
    }

    await updatesCol(user.uid).doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("Delete update error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete update" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const { searchParams } = new URL(request.url);

    // Single update by ID
    const id = searchParams.get("id");
    if (id) {
      const doc = await updatesCol(user.uid).doc(id).get();
      if (!doc.exists) {
        return NextResponse.json({ success: false, error: "Update not found" }, { status: 404 });
      }
      return NextResponse.json({ update: { id: doc.id, ...doc.data() } });
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

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    const { date, rawTranscript, slackOutput, teamsOutput, workLogEntries, slackEnabled, teamsEnabled, jiraEnabled } = body;

    // Build work log entries with IDs
    const entries: WorkLogEntryDoc[] = (workLogEntries || []).map(
      (entry: { issueKey: string; timeSpentSecs: number; started: string; comment?: string; isRepeat: boolean }) => ({
        id: crypto.randomUUID(),
        issueKey: entry.issueKey,
        timeSpentSecs: entry.timeSpentSecs,
        started: parseAsWallClock(entry.started).toISOString(),
        comment: entry.comment || "",
        isRepeat: entry.isRepeat || false,
        jiraWorklogId: null,
      })
    );

    const updateData = {
      createdAt: new Date().toISOString(),
      date: new Date(date).toISOString(),
      rawTranscript,
      slackOutput: slackOutput || "",
      teamsOutput: teamsOutput || "",
      slackStatus: slackEnabled ? "PENDING" : "SKIPPED",
      teamsStatus: teamsEnabled ? "PENDING" : "SKIPPED",
      jiraStatus: jiraEnabled ? "PENDING" : "SKIPPED",
      workLogEntries: entries,
    };

    const docRef = await updatesCol(user.uid).add(updateData);
    const update = { id: docRef.id, ...updateData };

    // Fetch Jira baseUrl for linkifying
    let jiraBaseUrl: string | null = null;
    try {
      const jiraDoc = await configsCol(user.uid).doc("JIRA").get();
      jiraBaseUrl = jiraDoc.data()?.baseUrl?.trim() || null;
    } catch { /* ignore */ }

    // Publish to Slack
    if (slackEnabled && slackOutput) {
      try {
        const slackDoc = await configsCol(user.uid).doc("SLACK").get();
        const slackConfig = slackDoc.data();

        if (slackConfig?.isActive) {
          const linkedSlackOutput = jiraBaseUrl ? linkifyTickets(slackOutput, jiraBaseUrl, "slack") : slackOutput;

          if (slackConfig.slackThreadMode && slackConfig.slackBotToken && slackConfig.slackChannelId) {
            await publishSlackViaThread(slackConfig as Parameters<typeof publishSlackViaThread>[0], linkedSlackOutput, slackConfig.userId, date, slackConfig.teamLeadId);
            await docRef.update({ slackStatus: "SENT" });
            update.slackStatus = "SENT";
          } else if (slackConfig.webhookUrl) {
            await sendSlackWebhook(slackConfig.webhookUrl, linkedSlackOutput, slackConfig.userId, date, slackConfig.teamLeadId);
            await docRef.update({ slackStatus: "SENT" });
            update.slackStatus = "SENT";
          } else {
            await docRef.update({ slackStatus: "FAILED" });
            update.slackStatus = "FAILED";
          }
        }
      } catch (err) {
        console.error("[Narada] Slack publish error:", err);
        await docRef.update({ slackStatus: "FAILED" });
        update.slackStatus = "FAILED";
      }
    }

    // Publish to Teams
    if (teamsEnabled && teamsOutput) {
      try {
        const teamsDoc = await configsCol(user.uid).doc("TEAMS").get();
        const teamsConfig = teamsDoc.data();

        if (teamsConfig?.isActive && teamsConfig?.webhookUrl) {
          const linkedTeamsOutput = jiraBaseUrl ? linkifyTickets(teamsOutput, jiraBaseUrl, "teams") : teamsOutput;
          await sendTeamsWebhook(teamsConfig.webhookUrl, linkedTeamsOutput, teamsConfig.userName, teamsConfig.userId, date, teamsConfig.teamLeadName, teamsConfig.teamLeadId);
          await docRef.update({ teamsStatus: "SENT" });
          update.teamsStatus = "SENT";
        } else {
          await docRef.update({ teamsStatus: "FAILED" });
          update.teamsStatus = "FAILED";
        }
      } catch (err) {
        console.error("[Narada] Teams publish error:", err);
        await docRef.update({ teamsStatus: "FAILED" });
        update.teamsStatus = "FAILED";
      }
    }

    // Publish to Jira
    if (jiraEnabled && entries.length > 0) {
      try {
        const jiraDoc = await configsCol(user.uid).doc("JIRA").get();
        const jiraConfig = jiraDoc.data();

        if (jiraConfig?.isActive && jiraConfig?.baseUrl && jiraConfig?.email && jiraConfig?.apiToken) {
          await publishJiraWorklogs(
            { baseUrl: jiraConfig.baseUrl, email: jiraConfig.email, apiToken: jiraConfig.apiToken, timezone: jiraConfig.timezone || "Asia/Kolkata" },
            entries,
            docRef
          );
          const refreshed = await docRef.get();
          const refreshedData = refreshed.data();
          update.jiraStatus = refreshedData?.jiraStatus ?? update.jiraStatus;
          update.workLogEntries = refreshedData?.workLogEntries ?? update.workLogEntries;
        } else {
          await docRef.update({ jiraStatus: "FAILED" });
          update.jiraStatus = "FAILED";
        }
      } catch (err) {
        console.error("[Narada] Jira publish error:", err);
        await docRef.update({ jiraStatus: "FAILED" });
        update.jiraStatus = "FAILED";
      }
    }

    return NextResponse.json({ success: true, update });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("Create update error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create update" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT — Retry failed platforms
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    const { updateId, slackOutput, teamsOutput, workLogEntries, retrySlack, retryTeams, retryJira } = body;

    if (!updateId) {
      return NextResponse.json({ success: false, error: "Missing updateId" }, { status: 400 });
    }

    const docRef = updatesCol(user.uid).doc(updateId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ success: false, error: "Update not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (retrySlack && slackOutput !== undefined) {
      updateData.slackOutput = slackOutput;
      updateData.slackStatus = "PENDING";
    }
    if (retryTeams && teamsOutput !== undefined) {
      updateData.teamsOutput = teamsOutput;
      updateData.teamsStatus = "PENDING";
    }
    if (retryJira) {
      updateData.jiraStatus = "PENDING";
    }

    if (Object.keys(updateData).length > 0) {
      await docRef.update(updateData);
    }

    const existing = doc.data()!;
    const dateStr = new Date(existing.date).toISOString().split("T")[0];

    // Fetch Jira baseUrl
    let jiraBaseUrl: string | null = null;
    try {
      const jiraDoc = await configsCol(user.uid).doc("JIRA").get();
      jiraBaseUrl = jiraDoc.data()?.baseUrl?.trim() || null;
    } catch { /* ignore */ }

    // Retry Slack
    if (retrySlack) {
      try {
        const slackDoc = await configsCol(user.uid).doc("SLACK").get();
        const slackConfig = slackDoc.data();

        const finalOutput = jiraBaseUrl
          ? linkifyTickets(slackOutput ?? existing.slackOutput, jiraBaseUrl, "slack")
          : (slackOutput ?? existing.slackOutput);

        if (slackConfig?.slackThreadMode && slackConfig.slackBotToken && slackConfig.slackChannelId) {
          await publishSlackViaThread(slackConfig as Parameters<typeof publishSlackViaThread>[0], finalOutput, slackConfig.userId, dateStr, slackConfig.teamLeadId);
          await docRef.update({ slackStatus: "SENT" });
        } else if (slackConfig?.webhookUrl) {
          await sendSlackWebhook(slackConfig.webhookUrl, finalOutput, slackConfig.userId, dateStr, slackConfig.teamLeadId);
          await docRef.update({ slackStatus: "SENT" });
        } else {
          await docRef.update({ slackStatus: "FAILED" });
        }
      } catch (err) {
        console.error("[Narada] Slack retry error:", err);
        await docRef.update({ slackStatus: "FAILED" });
      }
    }

    // Retry Teams
    if (retryTeams) {
      try {
        const teamsDoc = await configsCol(user.uid).doc("TEAMS").get();
        const teamsConfig = teamsDoc.data();

        if (teamsConfig?.webhookUrl) {
          const finalOutput = jiraBaseUrl
            ? linkifyTickets(teamsOutput ?? existing.teamsOutput, jiraBaseUrl, "teams")
            : (teamsOutput ?? existing.teamsOutput);
          await sendTeamsWebhook(teamsConfig.webhookUrl, finalOutput, teamsConfig.userName, teamsConfig.userId, dateStr, teamsConfig.teamLeadName, teamsConfig.teamLeadId);
          await docRef.update({ teamsStatus: "SENT" });
        } else {
          await docRef.update({ teamsStatus: "FAILED" });
        }
      } catch (err) {
        console.error("[Narada] Teams retry error:", err);
        await docRef.update({ teamsStatus: "FAILED" });
      }
    }

    // Retry Jira
    if (retryJira && workLogEntries?.length > 0) {
      try {
        const newEntries: WorkLogEntryDoc[] = (workLogEntries as {
          issueKey: string; timeSpentSecs: number; started: string; comment?: string; isRepeat: boolean; jiraWorklogId?: string | null;
        }[])
          .filter((e) => !e.jiraWorklogId)
          .map((entry) => ({
            id: crypto.randomUUID(),
            issueKey: entry.issueKey,
            timeSpentSecs: entry.timeSpentSecs,
            started: parseAsWallClock(entry.started).toISOString(),
            comment: entry.comment || "",
            isRepeat: entry.isRepeat || false,
            jiraWorklogId: null,
          }));

        // Keep already-posted entries, replace unposted
        const currentEntries: WorkLogEntryDoc[] = existing.workLogEntries || [];
        const postedEntries = currentEntries.filter((e: WorkLogEntryDoc) => e.jiraWorklogId);
        const allEntries = [...postedEntries, ...newEntries];
        await docRef.update({ workLogEntries: allEntries });

        const jiraDoc = await configsCol(user.uid).doc("JIRA").get();
        const jiraConfig = jiraDoc.data();

        if (jiraConfig?.baseUrl && jiraConfig?.email && jiraConfig?.apiToken) {
          // Pass full array — publishJiraWorklogs skips already-posted entries
          await publishJiraWorklogs(
            { baseUrl: jiraConfig.baseUrl, email: jiraConfig.email, apiToken: jiraConfig.apiToken, timezone: jiraConfig.timezone || "Asia/Kolkata" },
            allEntries,
            docRef
          );
        } else {
          await docRef.update({ jiraStatus: "FAILED" });
        }
      } catch (err) {
        console.error("[Narada] Jira retry error:", err);
        await docRef.update({ jiraStatus: "FAILED" });
      }
    } else if (retryJira) {
      await docRef.update({ jiraStatus: "SENT" });
    }

    // Return refreshed update
    const final = await docRef.get();
    return NextResponse.json({ success: true, update: { id: final.id, ...final.data() } });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("Retry update error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to retry update" },
      { status: 500 }
    );
  }
}
