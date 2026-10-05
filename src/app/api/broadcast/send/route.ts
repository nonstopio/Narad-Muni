import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { broadcastsCol, getSlackCreds } from "@/lib/firestore-helpers";
import { errorMessage } from "@/lib/utils";
import {
  cancelAllScheduled,
  occurrences,
  openDm,
  renderTemplate,
  scheduleDm,
  sendDm,
  SEND_DELAY_MS,
  type ScheduledRef,
} from "@/lib/slack-dm";
import type {
  BroadcastCadence,
  BroadcastRecipient,
  BroadcastTemplateData,
} from "@/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface SendResult {
  userId: string;
  name: string;
  ok: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    const { templateId, cadence, startDate, time, timezone } = body as {
      templateId?: string;
      cadence?: BroadcastCadence;
      startDate?: string;
      time?: string;
      timezone?: string;
    };

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: "Which scroll shall I carry?" },
        { status: 400 }
      );
    }

    const { token, timezone: configTz } = await getSlackCreds(user.uid);
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Grant me a Slack Bot or User Token in Sacred Configurations first",
        },
        { status: 400 }
      );
    }

    const snap = await broadcastsCol(user.uid).doc(templateId).get();
    if (!snap.exists) {
      return NextResponse.json(
        { success: false, error: "That scroll has vanished from my satchel" },
        { status: 404 }
      );
    }
    const template = snap.data() as Omit<BroadcastTemplateData, "id">;
    const recipients: BroadcastRecipient[] = template.recipients || [];

    if (recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: "Name at least one soul to receive this scroll" },
        { status: 400 }
      );
    }

    const mode: BroadcastCadence = cadence || "once";

    // Immediate delivery
    if (mode === "once") {
      const results: SendResult[] = [];
      for (const r of recipients) {
        try {
          await sendDm(token, r.id, renderTemplate(template.body, r));
          results.push({ userId: r.id, name: r.name, ok: true });
        } catch (err) {
          console.error(`[Narada -> Slack DM] ${r.id} failed:`, err);
          results.push({
            userId: r.id,
            name: r.name,
            ok: false,
            error: errorMessage(err, "Unknown error"),
          });
        }
        await sleep(SEND_DELAY_MS);
      }

      const sent = results.filter((r) => r.ok).length;
      console.log(
        `[Narada] POST /api/broadcast/send uid=${user.uid} id=${templateId} sent=${sent}/${results.length}`
      );
      return NextResponse.json({ success: sent > 0, results, scheduledCount: 0 });
    }

    // Recurring delivery — hand the occurrences to Slack itself
    if (!startDate || !time) {
      return NextResponse.json(
        { success: false, error: "A recurring scroll needs a first date and an hour" },
        { status: 400 }
      );
    }

    const tz = timezone?.trim() || configTz || "UTC";
    const times = occurrences(startDate, time, mode, tz);

    if (times.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No moments fall within Slack's 120-day horizon — choose a nearer date",
        },
        { status: 400 }
      );
    }

    const results: SendResult[] = [];
    const scheduled: ScheduledRef[] = [];

    for (const r of recipients) {
      try {
        const channel = await openDm(token, r.id);
        const text = renderTemplate(template.body, r);
        for (const postAt of times) {
          const ref = await scheduleDm(token, channel, text, postAt);
          scheduled.push(ref);
          await sleep(SEND_DELAY_MS);
        }
        results.push({ userId: r.id, name: r.name, ok: true });
      } catch (err) {
        console.error(`[Narada -> Slack DM] schedule ${r.id} failed:`, err);
        results.push({
          userId: r.id,
          name: r.name,
          ok: false,
          error: errorMessage(err, "Unknown error"),
        });
      }
    }

    const existing: ScheduledRef[] = template.scheduled || [];
    await broadcastsCol(user.uid)
      .doc(templateId)
      .set({ scheduled: [...existing, ...scheduled] }, { merge: true });

    console.log(
      `[Narada] POST /api/broadcast/send uid=${user.uid} id=${templateId} cadence=${mode} queued=${scheduled.length}`
    );

    return NextResponse.json({
      success: scheduled.length > 0,
      results,
      scheduledCount: scheduled.length,
      occurrences: times.length,
    });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API Broadcast] send failed:", error);
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Failed to send") },
      { status: 500 }
    );
  }
}

/** Withdraw every queued send for a template. */
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const templateId = request.nextUrl.searchParams.get("templateId");
    if (!templateId) {
      return NextResponse.json({ success: false, error: "Which scroll?" }, { status: 400 });
    }

    const { token } = await getSlackCreds(user.uid);
    if (!token) {
      return NextResponse.json(
        { success: false, error: "No Slack token is configured" },
        { status: 400 }
      );
    }

    const docRef = broadcastsCol(user.uid).doc(templateId);
    const snap = await docRef.get();
    const scheduled: ScheduledRef[] = (snap.data()?.scheduled as ScheduledRef[]) || [];

    const cancelled = await cancelAllScheduled(token, scheduled);

    await docRef.set({ scheduled: [] }, { merge: true });
    console.log(
      `[Narada] DELETE /api/broadcast/send uid=${user.uid} id=${templateId} cancelled=${cancelled}/${scheduled.length}`
    );

    return NextResponse.json({ success: true, cancelled });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API Broadcast] cancel failed:", error);
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Failed to cancel") },
      { status: 500 }
    );
  }
}
