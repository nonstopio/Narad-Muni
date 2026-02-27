/**
 * Slack thread reply mode — find a workflow message and post as a thread reply.
 * Uses Slack Web API (Bot Token) instead of Incoming Webhooks.
 */

const SLACK_API = "https://slack.com/api";

interface SlackMessage {
  ts: string;
  text?: string;
  bot_id?: string;
  subtype?: string;
}

interface ConversationsHistoryResponse {
  ok: boolean;
  messages?: SlackMessage[];
  error?: string;
}

interface ChatPostMessageResponse {
  ok: boolean;
  ts?: string;
  error?: string;
}

/**
 * Convert a date string + HH:MM time + timezone into a UTC epoch (seconds).
 * Uses Intl to resolve the timezone offset for that specific date/time.
 */
function workflowTimeToUtcEpoch(
  date: string,
  time: string,
  timezone: string
): number {
  const [hh, mm] = time.split(":").map(Number);

  // Parse the date components
  const [year, month, day] = date.split("-").map(Number);

  // Create a Date object representing the wall-clock time in the given timezone.
  // We need to find the UTC equivalent of `date time` in `timezone`.
  // Strategy: create a UTC date with the wall-clock components, then compute
  // the timezone offset at that approximate instant, and adjust.
  const guessUtc = new Date(Date.UTC(year, month - 1, day, hh, mm, 0));

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(guessUtc).map((x) => [x.type, x.value])
  );
  const wallInTz = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`
  );
  // offset = how far ahead the timezone is from UTC (ms)
  const offsetMs = wallInTz.getTime() - guessUtc.getTime();

  // True UTC = wall-clock minus offset
  const trueUtc = new Date(guessUtc.getTime() - offsetMs);
  return Math.floor(trueUtc.getTime() / 1000);
}

/**
 * Search channel messages for a workflow/bot message containing `matchText`.
 * Returns the message `ts` (thread parent) or `null` if not found.
 *
 * When `workflowTime` is provided (HH:MM format), the search window narrows
 * to a 10-minute window centered on that time (in the given timezone).
 * Otherwise falls back to the full day (UTC).
 */
export async function findWorkflowThread(
  botToken: string,
  channelId: string,
  date: string,
  matchText?: string | null,
  workflowTime?: string | null,
  timezone?: string | null
): Promise<string | null> {
  // Normalize date to YYYY-MM-DD (strip time component from ISO strings)
  const dateStr = date.includes("T") ? date.split("T")[0] : date;
  const searchText = (matchText || "Daily Status Update").toLowerCase();

  let oldest: string;
  let latest: string;
  let limit: string;

  if (workflowTime && timezone) {
    // Narrow 10-minute window centered on workflow time
    const centerEpoch = workflowTimeToUtcEpoch(dateStr, workflowTime, timezone);
    oldest = (centerEpoch - 5 * 60).toString(); // -5 minutes
    latest = (centerEpoch + 5 * 60).toString(); // +5 minutes
    limit = "20";
    console.log(
      `[Narada -> Slack Thread] Searching channel ${channelId} for "${searchText}" on ${dateStr} in ${workflowTime} ${timezone} window (${oldest}–${latest})`
    );
  } else {
    // Full day fallback (start of day to end of day UTC)
    const d = new Date(dateStr + "T00:00:00Z");
    oldest = Math.floor(d.getTime() / 1000).toString();
    latest = Math.floor(d.getTime() / 1000 + 86400).toString();
    limit = "200";
    console.log(
      `[Narada -> Slack Thread] Searching channel ${channelId} for "${searchText}" on ${dateStr} (full day)`
    );
  }

  const params = new URLSearchParams({
    channel: channelId,
    oldest,
    latest,
    limit,
    inclusive: "true",
  });

  const res = await fetch(`${SLACK_API}/conversations.history?${params}`, {
    headers: { Authorization: `Bearer ${botToken}` },
  });

  const data: ConversationsHistoryResponse = await res.json();

  if (!data.ok) {
    console.error(`[Narada -> Slack Thread] conversations.history error: ${data.error}`);
    throw new Error(`Slack API error: ${data.error}`);
  }

  const messages = data.messages || [];
  console.log(
    `[Narada -> Slack Thread] Found ${messages.length} messages in time range`
  );

  // Find the first bot message containing the match text
  const match = messages.find(
    (msg) => msg.text && msg.text.toLowerCase().includes(searchText)
  );

  if (match) {
    console.log(
      `[Narada -> Slack Thread] Found matching message: ts=${match.ts}`
    );
    return match.ts;
  }

  console.log(`[Narada -> Slack Thread] No matching message found`);
  return null;
}

/**
 * Post a message as a thread reply under the given parent message.
 */
export async function postThreadReply(
  botToken: string,
  channelId: string,
  threadTs: string,
  text: string
): Promise<void> {
  console.log(
    `[Narada -> Slack Thread] Posting thread reply to ${channelId}, thread_ts=${threadTs}, length=${text.length}`
  );

  const res = await fetch(`${SLACK_API}/chat.postMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: channelId,
      thread_ts: threadTs,
      text,
    }),
  });

  const data: ChatPostMessageResponse = await res.json();

  if (!data.ok) {
    console.error(`[Narada -> Slack Thread] chat.postMessage error: ${data.error}`);
    throw new Error(`Slack API error: ${data.error}`);
  }

  console.log(`[Narada -> Slack Thread] Reply posted successfully, ts=${data.ts}`);
}
