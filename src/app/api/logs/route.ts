import { NextRequest, NextResponse } from "next/server";
import { getLogContents } from "@/lib/logger";
import { verifyAuth, handleAuthError } from "@/lib/auth-middleware";

export async function GET(request: NextRequest) {
  try {
    await verifyAuth(request);
  } catch (e) {
    return handleAuthError(e);
  }

  const logs = getLogContents(500);

  if (!logs) {
    return new NextResponse(
      "Narayan Narayan! The sacred scrolls are empty — no chronicles have been inscribed yet.",
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }

  return new NextResponse(logs, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
