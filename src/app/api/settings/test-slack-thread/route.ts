import { NextRequest, NextResponse } from "next/server";
import { findWorkflowThread } from "@/lib/slack-thread";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";

interface AuthTestResponse {
  ok: boolean;
  user?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    await verifyAuth(request);
    const body = await request.json();
    const { botToken, channelId, workflowTime, matchText, timezone } = body as {
      botToken?: string;
      channelId?: string;
      workflowTime?: string;
      matchText?: string;
      timezone?: string;
    };

    if (!botToken?.trim() || !botToken.trim().startsWith("xoxb-")) {
      return NextResponse.json({
        success: false,
        error: "Invalid bot token — check the token starts with xoxb-",
      });
    }

    if (!channelId?.trim() || !channelId.trim().startsWith("C")) {
      return NextResponse.json({
        success: false,
        error: "A valid Channel ID starting with C is required",
      });
    }

    const token = botToken.trim();
    const channel = channelId.trim();

    // Step 1 — Auth check via auth.test
    let botName: string;
    try {
      const authRes = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const authData: AuthTestResponse = await authRes.json();

      if (!authData.ok) {
        if (authData.error === "invalid_auth" || authData.error === "not_authed") {
          return NextResponse.json({
            success: false,
            error: "Invalid bot token — check the token starts with xoxb-",
          });
        }
        return NextResponse.json({
          success: false,
          error: `Slack auth failed: ${authData.error}`,
        });
      }

      botName = authData.user || "Bot";
    } catch {
      return NextResponse.json({
        success: false,
        error: "Could not reach Slack — check your network connection",
      });
    }

    // Step 2 — Find workflow thread for today
    const today = new Date().toISOString().split("T")[0];
    try {
      const threadTs = await findWorkflowThread(
        token,
        channel,
        today,
        matchText || null,
        workflowTime || null,
        timezone || null
      );

      if (threadTs) {
        return NextResponse.json({
          success: true,
          message: `Connected as ${botName}. Workflow thread found for today.`,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: `Connected as ${botName}, but no workflow message found for today — make sure the workflow has run`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("channel_not_found") || msg.includes("not_in_channel")) {
        return NextResponse.json({
          success: false,
          error: `Bot authenticated as ${botName} but cannot access channel — invite the bot to the channel`,
        });
      }
      return NextResponse.json({
        success: false,
        error: `Connected as ${botName}, but channel lookup failed: ${msg}`,
      });
    }
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada] Test Slack thread error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    );
  }
}
