import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
              started: new Date(entry.started),
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

    // TODO: Publish to Jira when implemented

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
