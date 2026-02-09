import { NextRequest, NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import type { ClaudeTimeEntry } from "@/types/claude";

export async function POST(request: NextRequest) {
  try {
    const { transcript, date, repeatEntries } = await request.json();

    if (!transcript) {
      return NextResponse.json(
        { success: false, error: "No transcript provided" },
        { status: 400 }
      );
    }

    // Fetch repeat entries from DB if not provided
    let repeats = repeatEntries;
    if (!repeats) {
      const jiraConfig = await prisma.platformConfig.findFirst({
        where: { platform: "JIRA" },
        include: { repeatEntries: true },
      });
      repeats = jiraConfig?.repeatEntries ?? [];
    }

    const provider = await getAIProvider();
    const result = await provider.parseTranscript(transcript, date, repeats);

    // Merge repeat entries into time entries
    const repeatTimeEntries: ClaudeTimeEntry[] = (repeats || []).map(
      (entry: { ticketId: string; hours: number; startTime: string; comment: string }) => ({
        issueKey: entry.ticketId,
        timeSpentSecs: entry.hours * 3600,
        started: `${date}T${entry.startTime}:00`,
        comment: entry.comment,
        isRepeat: true,
      })
    );

    // Merge and sort by start time
    const allTimeEntries = [...repeatTimeEntries, ...result.timeEntries].sort(
      (a, b) => a.started.localeCompare(b.started)
    );

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        timeEntries: allTimeEntries,
      },
    });
  } catch (error) {
    console.error("Parse error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Parsing failed",
      },
      { status: 500 }
    );
  }
}
