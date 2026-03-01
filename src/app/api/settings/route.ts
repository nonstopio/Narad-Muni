import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { configsCol } from "@/lib/firestore-helpers";
import { type QueryDocumentSnapshot } from "firebase-admin/firestore";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const snapshot = await configsCol(user.uid).get();

    const configs = snapshot.docs.map((doc: QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort by platform name for consistent ordering
    configs.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
      ((a.platform as string) || "").localeCompare((b.platform as string) || "")
    );

    return NextResponse.json({ configs });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API Settings] GET failed:", error);
    return NextResponse.json({ configs: [], error: error instanceof Error ? error.message : "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    const {
      id,
      userName, userId, webhookUrl, apiToken, baseUrl, email, projectKey,
      timezone, teamLeadName, teamLeadId, slackBotToken, slackChannelId,
      slackThreadMode, slackThreadMatch, slackWorkflowTime, isActive, repeatEntries,
    } = body;

    const configData = {
      platform: id, // id is the platform name (SLACK, TEAMS, JIRA)
      userName, userId, webhookUrl, apiToken, baseUrl, email, projectKey,
      timezone, teamLeadName, teamLeadId, slackBotToken, slackChannelId,
      slackThreadMode, slackThreadMatch, slackWorkflowTime, isActive,
      repeatEntries: (repeatEntries || []).map(
        (entry: { ticketId: string; hours: number; startTime: string; comment: string }) => ({
          id: crypto.randomUUID(),
          ticketId: entry.ticketId,
          hours: entry.hours,
          startTime: entry.startTime,
          comment: entry.comment,
        })
      ),
    };

    await configsCol(user.uid).doc(id).set(configData, { merge: true });

    return NextResponse.json({ success: true, config: { id, ...configData } });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("Settings update error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}
