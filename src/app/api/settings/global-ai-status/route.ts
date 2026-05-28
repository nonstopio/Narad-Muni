import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { getGlobalAIConfig, globalKeyStatusFlags } from "@/lib/global-ai-config";

export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request);
    const config = await getGlobalAIConfig();
    return NextResponse.json(globalKeyStatusFlags(config));
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada] GET /api/settings/global-ai-status failed:", error);
    return NextResponse.json({ error: "Failed to fetch global AI status" }, { status: 500 });
  }
}
