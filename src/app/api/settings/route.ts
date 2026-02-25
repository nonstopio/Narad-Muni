import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    console.log("[Narada API Settings] GET /api/settings — fetching configs...");
    const configs = await prisma.platformConfig.findMany({
      include: { repeatEntries: true },
      orderBy: { platform: "asc" },
    });
    console.log(`[Narada API Settings] Found ${configs.length} configs:`, configs.map((c) => c.platform).join(", "));
    return NextResponse.json({ configs });
  } catch (error) {
    console.error("[Narada API Settings] GET failed:", error);
    return NextResponse.json({ configs: [], error: error instanceof Error ? error.message : "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      userName,
      userId,
      webhookUrl,
      apiToken,
      baseUrl,
      email,
      projectKey,
      timezone,
      teamLeadName,
      teamLeadId,
      isActive,
      repeatEntries,
    } = body;

    // Delete existing repeat entries for this config
    await prisma.repeatEntry.deleteMany({
      where: { configId: id },
    });

    // Update config and create new repeat entries
    const updated = await prisma.platformConfig.update({
      where: { id },
      data: {
        userName,
        userId,
        webhookUrl,
        apiToken,
        baseUrl,
        email,
        projectKey,
        timezone,
        teamLeadName,
        teamLeadId,
        isActive,
        repeatEntries: {
          create: (repeatEntries || []).map(
            (entry: {
              ticketId: string;
              hours: number;
              startTime: string;
              comment: string;
            }) => ({
              ticketId: entry.ticketId,
              hours: entry.hours,
              startTime: entry.startTime,
              comment: entry.comment,
            })
          ),
        },
      },
      include: { repeatEntries: true },
    });

    return NextResponse.json({ success: true, config: updated });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update settings",
      },
      { status: 500 }
    );
  }
}
