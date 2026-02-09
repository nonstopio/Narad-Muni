import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
