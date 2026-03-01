import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { settingsDoc } from "@/lib/firestore-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const doc = await settingsDoc(user.uid).get();
    const settings = doc.data();

    return NextResponse.json({
      notificationsEnabled: settings?.notificationsEnabled ?? false,
      notificationHour: settings?.notificationHour ?? 10,
      notificationMinute: settings?.notificationMinute ?? 0,
      notificationDays: settings?.notificationDays ?? "1,2,3,4,5",
    });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    return NextResponse.json({ error: "Failed to read notification settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    const { notificationsEnabled, notificationHour, notificationMinute, notificationDays } = body;

    if (notificationHour !== undefined && (notificationHour < 0 || notificationHour > 23)) {
      return NextResponse.json({ error: "Hour must be 0-23" }, { status: 400 });
    }
    if (notificationMinute !== undefined && (notificationMinute < 0 || notificationMinute > 59)) {
      return NextResponse.json({ error: "Minute must be 0-59" }, { status: 400 });
    }
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

    const ref = settingsDoc(user.uid);
    await ref.set(updateData, { merge: true });

    const doc = await ref.get();
    const settings = doc.data();

    return NextResponse.json({
      notificationsEnabled: settings?.notificationsEnabled ?? false,
      notificationHour: settings?.notificationHour ?? 10,
      notificationMinute: settings?.notificationMinute ?? 0,
      notificationDays: settings?.notificationDays ?? "1,2,3,4,5",
    });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    return NextResponse.json({ error: "Failed to save notification settings" }, { status: 500 });
  }
}
