import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { draftsCol } from "@/lib/firestore-helpers";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] GET /api/drafts uid=${user.uid}`);
    const dateStr = request.nextUrl.searchParams.get("date");
    if (!dateStr) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    const doc = await draftsCol(user.uid).doc(dateStr).get();
    return NextResponse.json({ draft: doc.exists ? { id: doc.id, ...doc.data() } : null });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API Drafts] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch draft" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] PUT /api/drafts uid=${user.uid}`);
    const body = await request.json();
    const { date: dateStr, rawTranscript } = body;

    if (!dateStr) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    // Empty transcript = delete the draft
    if (!rawTranscript || !rawTranscript.trim()) {
      await draftsCol(user.uid).doc(dateStr).delete();
      return NextResponse.json({ draft: null });
    }

    const draftData = {
      date: dateStr,
      rawTranscript,
      updatedAt: new Date().toISOString(),
    };

    await draftsCol(user.uid).doc(dateStr).set(draftData, { merge: true });
    return NextResponse.json({ draft: { id: dateStr, ...draftData } });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API Drafts] PUT failed:", error);
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] DELETE /api/drafts uid=${user.uid}`);
    const dateStr = request.nextUrl.searchParams.get("date");
    if (!dateStr) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }

    await draftsCol(user.uid).doc(dateStr).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API Drafts] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete draft" }, { status: 500 });
  }
}
