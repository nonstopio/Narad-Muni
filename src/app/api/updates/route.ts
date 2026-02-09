import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function sendSlackWebhook(webhookUrl: string, text: string): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack webhook failed (${res.status}): ${body}`);
  }
}

async function sendTeamsWebhook(webhookUrl: string, teamsOutput: string): Promise<void> {
  // Split the teamsOutput into sections by **HEADER** markers
  const sections = teamsOutput
    .split(/(?=\*\*(?:TODAY|TOMORROW|BLOCKER)\*\*)/)
    .map((s) => s.trim())
    .filter(Boolean);

  const textBlocks = sections.map((section, i) => ({
    type: "TextBlock" as const,
    text: section,
    wrap: true,
    ...(i > 0 ? { spacing: "Medium" as const } : {}),
  }));

  const card = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          type: "AdaptiveCard",
          version: "1.4",
          body: textBlocks,
        },
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
          await sendSlackWebhook(slackConfig.webhookUrl, slackOutput);
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
          await sendTeamsWebhook(teamsConfig.webhookUrl, teamsOutput);
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
