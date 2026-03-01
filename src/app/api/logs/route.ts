import { getLogContents } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function GET() {
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
