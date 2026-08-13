/**
 * Slack direct messages — send (or schedule) a personal scroll to individual members.
 * Uses the Web API. Prefers the User Token (xoxp-) so messages appear to come from
 * you personally; falls back to the Bot Token (xoxb-) when no user token is set.
 */

import { workflowTimeToUtcEpoch } from "./slack-thread";

const SLACK_API = "https://slack.com/api";

/** Slack refuses scheduled messages more than 120 days out. */
const MAX_SCHEDULE_DAYS = 119;
/** Cap how many future occurrences we enqueue in one go. */
const MAX_OCCURRENCES = 12;
/** Slack throttles bursts; a small pause between calls keeps us welcome. */
export const SEND_DELAY_MS = 150;

export interface SlackMember {
  id: string;
  name: string;
}

export interface ScheduledRef {
  channel: string;
  id: string;
  postAt: number;
}

async function slackCall<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
  query?: Record<string, string>
): Promise<T & { ok: boolean }> {
  const url = query
    ? `${SLACK_API}/${method}?${new URLSearchParams(query)}`
    : `${SLACK_API}/${method}`;

  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json; charset=utf-8" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();
  if (!data.ok) {
    // Slack names the blessing it wants; pass it on so the fix is obvious.
    if (data.error === "missing_scope" && data.needed) {
      throw new Error(
        `Alas! My Slack seal lacks the "${data.needed}" blessing — grant it in your Slack app, then reinstall it to the workspace`
      );
    }
    throw new Error(`Slack API error: ${data.error}`);
  }
  return data;
}

/** Every human in the workspace, for the recipient dropdown. */
export async function listMembers(token: string): Promise<SlackMember[]> {
  const members: SlackMember[] = [];
  let cursor = "";

  // Cap the paging so a huge workspace cannot spin forever.
  for (let page = 0; page < 10; page++) {
    const data = await slackCall<{
      members?: Array<{
        id: string;
        name?: string;
        real_name?: string;
        deleted?: boolean;
        is_bot?: boolean;
        profile?: { display_name?: string; real_name?: string };
      }>;
      response_metadata?: { next_cursor?: string };
    }>(token, "users.list", undefined, {
      limit: "200",
      ...(cursor ? { cursor } : {}),
    });

    for (const m of data.members || []) {
      if (m.deleted || m.is_bot || m.id === "USLACKBOT") continue;
      members.push({
        id: m.id,
        name:
          m.profile?.display_name?.trim() ||
          m.profile?.real_name?.trim() ||
          m.real_name?.trim() ||
          m.name ||
          m.id,
      });
    }

    cursor = data.response_metadata?.next_cursor || "";
    if (!cursor) break;
  }

  members.sort((a, b) => a.name.localeCompare(b.name));
  return members;
}

/** Open (or reuse) the DM channel with a member. */
export async function openDm(token: string, userId: string): Promise<string> {
  const data = await slackCall<{ channel?: { id: string } }>(
    token,
    "conversations.open",
    { users: userId }
  );
  const channel = data.channel?.id;
  if (!channel) throw new Error("Slack API error: no DM channel returned");
  return channel;
}

/** Send a DM right now. */
export async function sendDm(
  token: string,
  userId: string,
  text: string
): Promise<void> {
  const channel = await openDm(token, userId);
  await slackCall(token, "chat.postMessage", { channel, text });
}

/**
 * Queue a DM with Slack for a future moment — Slack delivers it whether or not
 * this app is running. Takes an already-open DM channel so a recurring schedule
 * opens the conversation once rather than once per occurrence.
 */
export async function scheduleDm(
  token: string,
  channel: string,
  text: string,
  postAt: number
): Promise<ScheduledRef> {
  const data = await slackCall<{ scheduled_message_id?: string }>(
    token,
    "chat.scheduleMessage",
    { channel, text, post_at: postAt }
  );
  return { channel, id: data.scheduled_message_id || "", postAt };
}

/** Withdraw a queued DM. */
export async function cancelScheduled(
  token: string,
  ref: ScheduledRef
): Promise<void> {
  await slackCall(token, "chat.deleteScheduledMessage", {
    channel: ref.channel,
    scheduled_message_id: ref.id,
  });
}

/**
 * Withdraw a whole queue. Slack forgets a scheduled message once it fires, so a
 * ref it no longer recognises is expected rather than an error — keep going.
 */
export async function cancelAllScheduled(
  token: string,
  refs: ScheduledRef[]
): Promise<number> {
  let cancelled = 0;
  for (const ref of refs) {
    try {
      await cancelScheduled(token, ref);
      cancelled++;
    } catch (err) {
      console.warn(`[Narada -> Slack DM] cancel ${ref.id} failed:`, err);
    }
    await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
  }
  return cancelled;
}

/** Substitute per-recipient placeholders into the template body. */
export function renderTemplate(body: string, member: SlackMember): string {
  return body
    .replaceAll("{{name}}", member.name)
    .replaceAll("{{first_name}}", member.name.split(/[\s.]/)[0]);
}

/**
 * Future send times for a cadence, as UTC epoch seconds.
 * Bounded by Slack's 120-day scheduling horizon and MAX_OCCURRENCES.
 */
export function occurrences(
  startDate: string,
  time: string,
  cadence: "weekly" | "monthly",
  timezone: string
): number[] {
  const out: number[] = [];
  const nowSec = Math.floor(Date.now() / 1000);
  const horizon = nowSec + MAX_SCHEDULE_DAYS * 86400;
  const [y, m, d] = startDate.split("-").map(Number);

  for (let i = 0; i < 60 && out.length < MAX_OCCURRENCES; i++) {
    let dt: Date;
    if (cadence === "weekly") {
      dt = new Date(Date.UTC(y, m - 1, d + i * 7));
    } else {
      // Clamp to the month's length so the 31st does not spill into the next month.
      const daysInMonth = new Date(Date.UTC(y, m + i, 0)).getUTCDate();
      dt = new Date(Date.UTC(y, m - 1 + i, Math.min(d, daysInMonth)));
    }

    const epoch = workflowTimeToUtcEpoch(
      dt.toISOString().slice(0, 10),
      time,
      timezone
    );
    if (epoch <= nowSec) continue;
    if (epoch > horizon) break;
    out.push(epoch);
  }

  return out;
}
