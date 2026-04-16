import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { handleAuthError } from "@/lib/auth-middleware";
import { adminDb } from "@/lib/firebase-admin";
import {
  DEFAULT_TIME_SAVED_CONSTANTS,
  invalidateTimeSavedCache,
  type TimeSavedConstants,
} from "@/lib/time-saved";

const DOC_REF = () => adminDb.collection("config").doc("timeSavedConstants");

function clamp(n: unknown, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.max(0, Math.round(v));
}

export async function GET(request: NextRequest) {
  try {
    await verifyAdmin(request);
    const snap = await DOC_REF().get();
    const data = snap.data() ?? {};
    const constants: TimeSavedConstants = {
      perPlatformSecs: clamp(data.perPlatformSecs, DEFAULT_TIME_SAVED_CONSTANTS.perPlatformSecs),
      perTaskSecs: clamp(data.perTaskSecs, DEFAULT_TIME_SAVED_CONSTANTS.perTaskSecs),
      perTimeEntrySecs: clamp(data.perTimeEntrySecs, DEFAULT_TIME_SAVED_CONSTANTS.perTimeEntrySecs),
    };
    return NextResponse.json(constants);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await verifyAdmin(request);
    const body = await request.json();
    const next: TimeSavedConstants = {
      perPlatformSecs: clamp(body.perPlatformSecs, DEFAULT_TIME_SAVED_CONSTANTS.perPlatformSecs),
      perTaskSecs: clamp(body.perTaskSecs, DEFAULT_TIME_SAVED_CONSTANTS.perTaskSecs),
      perTimeEntrySecs: clamp(body.perTimeEntrySecs, DEFAULT_TIME_SAVED_CONSTANTS.perTimeEntrySecs),
    };
    await DOC_REF().set(next, { merge: true });
    invalidateTimeSavedCache();
    return NextResponse.json(next);
  } catch (error) {
    return handleAuthError(error);
  }
}
