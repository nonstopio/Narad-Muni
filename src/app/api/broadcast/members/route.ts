import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { getSlackCreds } from "@/lib/firestore-helpers";
import { listMembers } from "@/lib/slack-dm";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const { token } = await getSlackCreds(user.uid);
    if (!token) {
      return NextResponse.json(
        {
          members: [],
          error:
            "Grant me a Slack Bot or User Token in Sacred Configurations before I can name your companions",
        },
        { status: 400 }
      );
    }

    const members = await listMembers(token);
    console.log(`[Narada] GET /api/broadcast/members uid=${user.uid} count=${members.length}`);

    return NextResponse.json({ members });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API Broadcast] members failed:", error);
    return NextResponse.json(
      {
        members: [],
        error: error instanceof Error ? error.message : "Failed to fetch members",
      },
      { status: 500 }
    );
  }
}
