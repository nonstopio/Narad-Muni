import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Jira worklog helpers
// ---------------------------------------------------------------------------

/** Format a Date as Jira-compatible UTC datetime.
 *
 *  `started` is stored with its UTC components holding the wall-clock time in
 *  the user's timezone (we append "Z" at storage to force this).  E.g. 10:00
 *  IST is stored as 10:00 UTC.  This function subtracts the timezone offset
 *  to get true UTC — matching the reference script's IST→UTC conversion. */
function toJiraUtc(started: Date, timezone: string): string {
  // The UTC components ARE the wall-clock time in `timezone`.
  // Use Intl to compute the timezone's offset at this approximate instant.
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
  // offset = how far ahead the timezone is from UTC (ms)
  const offsetMs = wallInTz.getTime() - started.getTime();

  // True UTC = stored wall-clock minus offset
  const utc = new Date(started.getTime() - offsetMs);

  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}` +
    `T${pad(utc.getUTCHours())}:${pad(utc.getUTCMinutes())}:${pad(utc.getUTCSeconds())}.000+0000`
  );
}

/** Parse an ISO-ish datetime string and store the wall-clock components as UTC.
 *  Strips any timezone suffix so "2026-02-09T11:00:00+05:30" stores as 11:00 UTC,
 *  preserving the literal hours/date the user intended. */
function parseAsWallClock(started: string): Date {
  const m = started.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  }
  return new Date(started + "Z"); // fallback for unexpected formats
}

/** Convert seconds to Jira's timeSpent string. E.g. 5400 → "1h 30m" */
function secsToTimeSpent(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return "0m";
}

/** Wrap plain text into Jira Atlassian Document Format (ADF). */
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

/** Publish work log entries to Jira, one request per entry. */
async function publishJiraWorklogs(
  config: { baseUrl: string; email: string; apiToken: string; timezone: string },
  entries: { id: string; issueKey: string; timeSpentSecs: number; started: Date; comment: string | null }[],
  updateId: string
): Promise<void> {
  const authToken = "Basic " + btoa(config.email + ":" + config.apiToken);
  let allSucceeded = true;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    try {
      const startedUtc = toJiraUtc(entry.started, config.timezone);
      const timeSpent = secsToTimeSpent(entry.timeSpentSecs);
      const payload = {
        timeSpent,
        started: startedUtc,
        comment: buildAdfComment(entry.comment || ""),
      };

      const url = `${config.baseUrl.replace(/\/+$/, "")}/rest/api/3/issue/${entry.issueKey}/worklog`;
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
        await prisma.workLogEntry.update({
          where: { id: entry.id },
          data: { jiraWorklogId: body.id?.toString() ?? null },
        });
        console.log(`[Narada] Jira worklog posted for ${entry.issueKey}`);
      } else {
        const errBody = await res.text();
        console.error(
          `[Narada] Jira worklog failed for ${entry.issueKey} (${res.status}): ${errBody}`
        );
        allSucceeded = false;
      }
    } catch (err) {
      console.error(`[Narada] Jira worklog error for ${entry.issueKey}:`, err);
      allSucceeded = false;
    }

    // 1s delay between requests to avoid rate limiting (skip after last)
    if (i < entries.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  await prisma.update.update({
    where: { id: updateId },
    data: { jiraStatus: allSucceeded ? "SENT" : "FAILED" },
  });
}

// ---------------------------------------------------------------------------

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(d.getDate()).padStart(2, "0");
  return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

async function sendSlackWebhook(
  webhookUrl: string,
  text: string,
  userId?: string | null,
  date?: string
): Promise<void> {
  let finalText = text;
  if (userId && date) {
    const displayDate = formatDateDisplay(date);
    finalText = `<@${userId}>'s Updates for \`${displayDate}\` :\n\n${text}`;
  }

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

async function sendTeamsWebhook(
  webhookUrl: string,
  teamsOutput: string,
  userName?: string | null,
  userId?: string | null,
  date?: string
): Promise<void> {
  // Split the teamsOutput into sections by **HEADER** markers
  const sections = teamsOutput
    .split(/(?=\*\*(?:TODAY|TOMORROW|BLOCKER)\*\*)/)
    .map((s) => s.trim())
    .filter(Boolean);

  const textBlocks: Array<{ type: "TextBlock"; text: string; wrap: boolean; size?: string; weight?: string; spacing?: string }> = [];
  const entities: Array<{ type: string; text: string; mentioned: { id: string; name: string } }> = [];

  // Add mention header if userName and userId are available
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

  const cardContent: Record<string, unknown> = {
    type: "AdaptiveCard",
    version: "1.4",
    body: textBlocks,
  };

  if (entities.length > 0) {
    cardContent.msteams = { entities };
  }

  const card = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: cardContent,
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Teams webhook failed (${res.status}): ${body}`);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing id parameter" },
        { status: 400 }
      );
    }

    await prisma.update.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete update error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete update",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  let where = {};
  if (month) {
    const [year, m] = month.split("-").map(Number);
    const startOfMonth = new Date(year, m - 1, 1);
    const endOfMonth = new Date(year, m, 0, 23, 59, 59);
    where = { date: { gte: startOfMonth, lte: endOfMonth } };
  }

  const updates = await prisma.update.findMany({
    where,
    include: { workLogEntries: true },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ updates });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      date,
      rawTranscript,
      slackOutput,
      teamsOutput,
      workLogEntries,
      slackEnabled,
      teamsEnabled,
      jiraEnabled,
    } = body;

    // Create the update record first
    const update = await prisma.update.create({
      data: {
        date: new Date(date),
        rawTranscript,
        slackOutput: slackOutput || "",
        teamsOutput: teamsOutput || "",
        slackStatus: slackEnabled ? "PENDING" : "SKIPPED",
        teamsStatus: teamsEnabled ? "PENDING" : "SKIPPED",
        jiraStatus: jiraEnabled ? "PENDING" : "SKIPPED",
        workLogEntries: {
          create: (workLogEntries || []).map(
            (entry: {
              issueKey: string;
              timeSpentSecs: number;
              started: string;
              comment?: string;
              isRepeat: boolean;
            }) => ({
              issueKey: entry.issueKey,
              timeSpentSecs: entry.timeSpentSecs,
              started: parseAsWallClock(entry.started),
              comment: entry.comment || "",
              isRepeat: entry.isRepeat || false,
            })
          ),
        },
      },
      include: { workLogEntries: true },
    });

    // Publish to Slack if enabled
    if (slackEnabled && slackOutput) {
      try {
        const slackConfig = await prisma.platformConfig.findFirst({
          where: { platform: "SLACK", isActive: true },
        });

        if (slackConfig?.webhookUrl) {
          await sendSlackWebhook(slackConfig.webhookUrl, slackOutput, slackConfig.userId, date);
          await prisma.update.update({
            where: { id: update.id },
            data: { slackStatus: "SENT" },
          });
          update.slackStatus = "SENT";
        } else {
          await prisma.update.update({
            where: { id: update.id },
            data: { slackStatus: "FAILED" },
          });
          update.slackStatus = "FAILED";
          console.warn("[Narada] Slack enabled but no active webhook URL configured");
        }
      } catch (err) {
        console.error("[Narada] Slack publish error:", err);
        await prisma.update.update({
          where: { id: update.id },
          data: { slackStatus: "FAILED" },
        });
        update.slackStatus = "FAILED";
      }
    }

    // Publish to Teams if enabled
    if (teamsEnabled && teamsOutput) {
      try {
        const teamsConfig = await prisma.platformConfig.findFirst({
          where: { platform: "TEAMS", isActive: true },
        });

        if (teamsConfig?.webhookUrl) {
          await sendTeamsWebhook(teamsConfig.webhookUrl, teamsOutput, teamsConfig.userName, teamsConfig.userId, date);
          await prisma.update.update({
            where: { id: update.id },
            data: { teamsStatus: "SENT" },
          });
          update.teamsStatus = "SENT";
        } else {
          await prisma.update.update({
            where: { id: update.id },
            data: { teamsStatus: "FAILED" },
          });
          update.teamsStatus = "FAILED";
          console.warn("[Narada] Teams enabled but no active webhook URL configured");
        }
      } catch (err) {
        console.error("[Narada] Teams publish error:", err);
        await prisma.update.update({
          where: { id: update.id },
          data: { teamsStatus: "FAILED" },
        });
        update.teamsStatus = "FAILED";
      }
    }

    // Publish to Jira if enabled
    if (jiraEnabled && update.workLogEntries?.length > 0) {
      try {
        const jiraConfig = await prisma.platformConfig.findFirst({
          where: { platform: "JIRA", isActive: true },
        });

        if (jiraConfig?.baseUrl && jiraConfig?.email && jiraConfig?.apiToken) {
          await publishJiraWorklogs(
            {
              baseUrl: jiraConfig.baseUrl,
              email: jiraConfig.email,
              apiToken: jiraConfig.apiToken,
              timezone: jiraConfig.timezone || "Asia/Kolkata",
            },
            update.workLogEntries,
            update.id
          );
          // Re-read the status that publishJiraWorklogs set
          const refreshed = await prisma.update.findUnique({
            where: { id: update.id },
            select: { jiraStatus: true },
          });
          update.jiraStatus = refreshed?.jiraStatus ?? update.jiraStatus;
        } else {
          await prisma.update.update({
            where: { id: update.id },
            data: { jiraStatus: "FAILED" },
          });
          update.jiraStatus = "FAILED";
          console.warn("[Narada] Jira enabled but no active config (baseUrl/email/apiToken)");
        }
      } catch (err) {
        console.error("[Narada] Jira publish error:", err);
        await prisma.update.update({
          where: { id: update.id },
          data: { jiraStatus: "FAILED" },
        });
        update.jiraStatus = "FAILED";
      }
    }

    return NextResponse.json({ success: true, update });
  } catch (error) {
    console.error("Create update error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create update",
      },
      { status: 500 }
    );
  }
}
