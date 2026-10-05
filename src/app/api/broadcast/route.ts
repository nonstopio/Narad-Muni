import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { broadcastsCol, getSlackCreds } from "@/lib/firestore-helpers";
import { cancelAllScheduled, type ScheduledRef } from "@/lib/slack-dm";
import { type QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { BroadcastRecipient } from "@/types";
import { errorMessage } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] GET /api/broadcast uid=${user.uid}`);
    const snapshot = await broadcastsCol(user.uid).get();

    const templates = snapshot.docs.map((doc: QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    }));

    templates.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
      ((a.name as string) || "").localeCompare((b.name as string) || "")
    );

    return NextResponse.json({ templates });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API Broadcast] GET failed:", error);
    return NextResponse.json(
      { templates: [], error: errorMessage(error, "Failed to fetch templates") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    const { id, name, body: messageBody, recipients } = body as {
      id?: string;
      name?: string;
      body?: string;
      recipients?: BroadcastRecipient[];
    };

    if (!name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Every scroll needs a name" },
        { status: 400 }
      );
    }
    if (!messageBody?.trim()) {
      return NextResponse.json(
        { success: false, error: "The scroll cannot be blank" },
        { status: 400 }
      );
    }

    const docRef = id
      ? broadcastsCol(user.uid).doc(id)
      : broadcastsCol(user.uid).doc();

    const data = {
      name: name.trim(),
      body: messageBody,
      recipients: (recipients || [])
        .filter((r) => r?.id)
        .map((r) => ({ id: r.id, name: r.name || r.id })),
      updatedAt: new Date().toISOString(),
    };

    console.log(
      `[Narada] POST /api/broadcast uid=${user.uid} id=${docRef.id} recipients=${data.recipients.length}`
    );
    await docRef.set(data, { merge: true });

    return NextResponse.json({ success: true, template: { id: docRef.id, ...data } });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API Broadcast] POST failed:", error);
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Failed to save template") },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "Which scroll?" }, { status: 400 });
    }

    // Withdraw anything still queued first — otherwise Slack keeps delivering
    // missives for a scroll the user has burned, with no way left to stop them.
    const docRef = broadcastsCol(user.uid).doc(id);
    const scheduled: ScheduledRef[] =
      ((await docRef.get()).data()?.scheduled as ScheduledRef[]) || [];
    let cancelled = 0;
    if (scheduled.length > 0) {
      const { token } = await getSlackCreds(user.uid);
      if (token) cancelled = await cancelAllScheduled(token, scheduled);
    }

    console.log(
      `[Narada] DELETE /api/broadcast uid=${user.uid} id=${id} cancelled=${cancelled}/${scheduled.length}`
    );
    await docRef.delete();

    return NextResponse.json({ success: true, cancelled });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API Broadcast] DELETE failed:", error);
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Failed to delete template") },
      { status: 500 }
    );
  }
}
