import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { seedUserIfNeeded } from "@/lib/seed-user";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] POST /api/auth/seed uid=${user.uid}`);
    await seedUserIfNeeded(user.uid);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada] Seed failed:", error);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
