import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { leavesCol, updatesCol, isOnLeave } from "@/lib/firestore-helpers";
import { isDateKey, updateDateIso } from "@/lib/date-key";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] GET /api/leaves uid=${user.uid}`);
    const params = request.nextUrl.searchParams;

    const date = params.get("date");
    if (date !== null) {
      if (!isDateKey(date)) return NextResponse.json({ error: "invalid date" }, { status: 400 });
      return NextResponse.json({ onLeave: await isOnLeave(user.uid, date) });
    }

    // ?month=YYYY-MM → that month; no params → all (the streak walks every leave).
    const month = params.get("month");
    let query = leavesCol(user.uid).orderBy(FieldPath.documentId());
    if (month !== null) {
      if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "invalid month" }, { status: 400 });
      query = query.where(FieldPath.documentId(), ">=", `${month}-01`).where(FieldPath.documentId(), "<=", `${month}-31`);
    }
    const snap = await query.get();
    return NextResponse.json({ leaves: snap.docs.map((d) => d.id) });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API Leaves] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch leaves" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] PUT /api/leaves uid=${user.uid}`);
    const { date } = await request.json();
    if (!isDateKey(date)) return NextResponse.json({ error: "invalid date" }, { status: 400 });

    // ponytail: check-then-write, not a transaction. Two same-millisecond requests
    // from one user could both pass; use runTransaction here and in POST /api/updates if that ever matters.
    const existing = await updatesCol(user.uid).where("date", "==", updateDateIso(date)).limit(1).get();
    if (!existing.empty) return NextResponse.json({ error: "update-exists" }, { status: 409 });

    await leavesCol(user.uid).doc(date).set({ date, createdAt: new Date().toISOString() });
    return NextResponse.json({ onLeave: true });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API Leaves] PUT failed:", error);
    return NextResponse.json({ error: "Failed to mark leave" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] DELETE /api/leaves uid=${user.uid}`);
    const date = request.nextUrl.searchParams.get("date");
    if (!isDateKey(date)) return NextResponse.json({ error: "invalid date" }, { status: 400 });

    await leavesCol(user.uid).doc(date).delete();
    return NextResponse.json({ onLeave: false });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API Leaves] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to undo leave" }, { status: 500 });
  }
}
