import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "app-settings" },
    });

    return NextResponse.json({
      notificationsEnabled: settings?.notificationsEnabled ?? false,
      notificationHour: settings?.notificationHour ?? 9,
      notificationMinute: settings?.notificationMinute ?? 0,
      notificationDays: settings?.notificationDays ?? "1,2,3,4,5",
    });
  } catch (err) {
    console.error("[API /settings/notifications GET] Failed:", err);
    return NextResponse.json(
      { error: "Failed to read notification settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationsEnabled, notificationHour, notificationMinute, notificationDays } = body;

    // Validate hour
    if (notificationHour !== undefined && (notificationHour < 0 || notificationHour > 23)) {
      return NextResponse.json({ error: "Hour must be 0-23" }, { status: 400 });
    }

    // Validate minute
    if (notificationMinute !== undefined && (notificationMinute < 0 || notificationMinute > 59)) {
      return NextResponse.json({ error: "Minute must be 0-59" }, { status: 400 });
    }

    // Validate days (comma-separated digits 0-6)
    if (notificationDays !== undefined) {
      const days = notificationDays.split(",").filter(Boolean);
      const valid = days.every((d: string) => /^[0-6]$/.test(d.trim()));
      if (!valid) {
        return NextResponse.json({ error: "Days must be comma-separated digits 0-6" }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (notificationsEnabled !== undefined) updateData.notificationsEnabled = notificationsEnabled;
    if (notificationHour !== undefined) updateData.notificationHour = notificationHour;
    if (notificationMinute !== undefined) updateData.notificationMinute = notificationMinute;
    if (notificationDays !== undefined) updateData.notificationDays = notificationDays;

    await prisma.appSettings.upsert({
      where: { id: "app-settings" },
      update: updateData,
      create: {
        id: "app-settings",
        ...updateData,
      },
    });

    const settings = await prisma.appSettings.findUnique({
      where: { id: "app-settings" },
    });

    return NextResponse.json({
      notificationsEnabled: settings?.notificationsEnabled ?? false,
      notificationHour: settings?.notificationHour ?? 9,
      notificationMinute: settings?.notificationMinute ?? 0,
      notificationDays: settings?.notificationDays ?? "1,2,3,4,5",
    });
  } catch (err) {
    console.error("[API /settings/notifications PUT] Failed:", err);
    return NextResponse.json(
      { error: "Failed to save notification settings" },
      { status: 500 }
    );
  }
}
