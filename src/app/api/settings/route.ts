import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const configs = await prisma.platformConfig.findMany({
    include: { repeatEntries: true },
    orderBy: { platform: "asc" },
  });

  return NextResponse.json({ configs });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      webhookUrl,
      apiToken,
      baseUrl,
      email,
      projectKey,
      timezone,
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
        webhookUrl,
        apiToken,
        baseUrl,
        email,
        projectKey,
        timezone,
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
