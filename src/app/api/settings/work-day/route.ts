import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { settingsDoc } from "@/lib/firestore-helpers";
import { isWorkDayStart, isWorkHours, workDayFrom } from "@/lib/work-day";
import { errorMessage } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const doc = await settingsDoc(user.uid).get();
    return NextResponse.json(workDayFrom(doc.data()));
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada] GET /api/settings/work-day error:", error);
    return NextResponse.json({ error: errorMessage(error, "Failed to read work day") }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] PUT /api/settings/work-day uid=${user.uid}`);
    const { workDayStart, defaultWorkHours } = await request.json();

    if (workDayStart !== undefined && !isWorkDayStart(workDayStart)) {
      return NextResponse.json({ error: "Alas! The day must begin on the hour or half hour (HH:MM)" }, { status: 400 });
    }
    if (defaultWorkHours !== undefined && !isWorkHours(defaultWorkHours)) {
      return NextResponse.json({ error: "Alas! A day holds between half an hour and 24 hours, in half-hour steps" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (workDayStart !== undefined) updateData.workDayStart = workDayStart;
    if (defaultWorkHours !== undefined) updateData.defaultWorkHours = defaultWorkHours;

    const ref = settingsDoc(user.uid);
    await ref.set(updateData, { merge: true });
    return NextResponse.json(workDayFrom((await ref.get()).data()));
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada] PUT /api/settings/work-day error:", error);
    return NextResponse.json({ error: errorMessage(error, "Failed to save work day") }, { status: 500 });
  }
}
