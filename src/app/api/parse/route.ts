import { NextRequest, NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { configsCol, settingsDoc } from "@/lib/firestore-helpers";
import { time } from "@/lib/timing";
import { applyProjectSourceRules } from "@/lib/ai/project-rules";
import { enforceTimeRules, DEFAULT_TARGET_SECS } from "@/lib/ai/time-rules";
import type { ClaudeTimeEntry } from "@/types/claude";
import { errorMessage } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const routeStart = Date.now();
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] POST /api/parse uid=${user.uid}`);
    const { transcript, date, repeatEntries, source: rawSource, targetHours } = await request.json();
    const source = rawSource === "projects" ? "projects" : "manual";

    if (!transcript) {
      return NextResponse.json({ success: false, error: "No transcript provided" }, { status: 400 });
    }
    // Hours worked that day: 0.5–24 in half-hour steps; absent means 8.
    const validHours =
      typeof targetHours === "number" && targetHours >= 0.5 && targetHours <= 24 && Number.isInteger(targetHours * 2);
    if (targetHours !== undefined && !validHours) {
      return NextResponse.json(
        { success: false, error: "Alas! A day holds between half an hour and 24 hours, in half-hour steps" },
        { status: 400 }
      );
    }
    const targetSecs = targetHours === undefined ? DEFAULT_TARGET_SECS : targetHours * 3600;

    // Fetch repeat entries from Firestore if not provided
    let repeats = repeatEntries;
    if (!repeats) {
      const jiraDoc = await configsCol(user.uid).doc("JIRA").get();
      repeats = jiraDoc.data()?.repeatEntries ?? [];
    }

    // Read AI settings from Firestore to pass to provider
    const settingsSnap = await settingsDoc(user.uid).get();
    const settings = settingsSnap.data();
    const providerName = (settings?.aiProvider ?? "local-claude") as string;

    const provider = await getAIProvider(settings);
    console.log(`[Narada] POST /api/parse provider=${provider.name} date=${date} source=${source}`);
    const { result, ms: providerMs } = await time(() =>
      provider.parseTranscript(transcript, date, repeats, { source, targetSecs })
    );

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

    const merged = [...repeatTimeEntries, ...result.timeEntries];
    // Commits show coding, not the whole day: commit-sourced estimates still meet the chosen
    // hours, but keep their flags and evidence-checked ticket keys.
    const allTimeEntries = enforceTimeRules(
      source === "projects" ? applyProjectSourceRules(merged, transcript, repeats || []) : merged,
      targetSecs
    );
    const totalSecs = allTimeEntries.reduce((s, e) => s + e.timeSpentSecs, 0);
    console.log(`[Narada] POST /api/parse success: tasks=${result.tasks?.length ?? 0} entries=${allTimeEntries.length} totalSecs=${totalSecs} provider_ms=${providerMs}`);

    const totalMs = Date.now() - routeStart;
    return NextResponse.json({
      success: true,
      data: { ...result, timeEntries: allTimeEntries },
      _timings: {
        totalMs,
        providerMs,
        overheadMs: Math.max(0, totalMs - providerMs),
        provider: providerName,
        transcriptChars: transcript.length,
      },
    });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada] POST /api/parse error:", error);
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Parsing failed") },
      { status: 500 }
    );
  }
}
