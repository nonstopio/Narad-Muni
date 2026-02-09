import { NextRequest, NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import type { ClaudeTimeEntry } from "@/types/claude";

const MIN_TOTAL_SECS = 28800; // 8 hours
const MIN_ENTRY_SECS = 1800; // 30 minutes
const GRANULARITY_SECS = 1800; // 30-minute increments

function roundToGranularity(secs: number): number {
  const rounded = Math.round(secs / GRANULARITY_SECS) * GRANULARITY_SECS;
  return Math.max(MIN_ENTRY_SECS, rounded);
}

function enforceTimeRules(allEntries: ClaudeTimeEntry[]): ClaudeTimeEntry[] {
  const repeatEntries = allEntries.filter((e) => e.isRepeat);
  const nonRepeatEntries = allEntries.filter((e) => !e.isRepeat);

  if (nonRepeatEntries.length === 0) return allEntries;

  const repeatTotal = repeatEntries.reduce((sum, e) => sum + e.timeSpentSecs, 0);
  const nonRepeatTotal = nonRepeatEntries.reduce((sum, e) => sum + e.timeSpentSecs, 0);
  const targetNonRepeat = Math.max(0, MIN_TOTAL_SECS - repeatTotal);

  // Scale up non-repeat entries if total is under target
  let adjusted: ClaudeTimeEntry[];
  if (nonRepeatTotal > 0 && nonRepeatTotal < targetNonRepeat) {
    const scale = targetNonRepeat / nonRepeatTotal;
    adjusted = nonRepeatEntries.map((e) => ({
      ...e,
      timeSpentSecs: roundToGranularity(e.timeSpentSecs * scale),
    }));
  } else {
    adjusted = nonRepeatEntries.map((e) => ({
      ...e,
      timeSpentSecs: roundToGranularity(e.timeSpentSecs),
    }));
  }

  // Ensure minimum per entry
  adjusted = adjusted.map((e) => ({
    ...e,
    timeSpentSecs: Math.max(MIN_ENTRY_SECS, e.timeSpentSecs),
  }));

  return [...repeatEntries, ...adjusted].sort((a, b) =>
    a.started.localeCompare(b.started)
  );
}

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

    // Merge, enforce time rules, and sort by start time
    const merged = [...repeatTimeEntries, ...result.timeEntries];
    const allTimeEntries = enforceTimeRules(merged);

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
