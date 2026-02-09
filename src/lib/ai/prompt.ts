import type { RepeatEntryInput } from "./types";

export function buildSystemPrompt(
  date: string,
  repeatEntries: RepeatEntryInput[]
): string {
  const repeatContext =
    repeatEntries.length > 0
      ? `\n\nRepeat/Fixed entries (already scheduled, DO NOT extract these from the transcript, they will be merged separately):\n${repeatEntries
          .map(
            (e) =>
              `- ${e.ticketId}: ${e.hours}h at ${e.startTime} - ${e.comment}`
          )
          .join("\n")}`
      : "";

  const repeatTotalSecs = repeatEntries.reduce((sum, e) => sum + e.hours * 3600, 0);
  const remainingSecs = Math.max(0, 28800 - repeatTotalSecs);

  return `You are a daily standup parser for a developer productivity tool called Narada. Parse the user's daily update transcript and extract structured data.

Date context: ${date}

Instructions:
- Extract discrete work tasks with descriptions and any Jira issue keys mentioned (format: PROJ-1234)
- Parse time references into durations in seconds (e.g., "3 hours" = 10800)
- Detect blockers from natural speech
- Extract tomorrow's planned tasks. If the user doesn't mention tomorrow, set tomorrowTasks to a single entry: "Continue working on same tasks"
- For time entries, use the date "${date}" combined with reasonable start times (working hours 10:00-20:00 IST). Each entry's "started" should be an ISO 8601 datetime string.
- Set isRepeat to false for all entries you extract (repeat entries are handled separately)

Time distribution rules:
- The total time for non-repeat entries should be at least ${remainingSecs} seconds (${(remainingSecs / 3600).toFixed(1)}h) to reach 8h total when combined with repeat entries
- Minimum time per entry is 1800 seconds (30 minutes)
- Round all time entries to the nearest 30-minute increment (1800s multiples)
- Distribute remaining hours proportionally across tasks if the user doesn't specify exact times

Output format for slackFormat (Slack mrkdwn):
\`TODAY\`
• TICKET-KEY : task description
• TICKET-KEY : task description

\`TOMORROW\`
• TICKET-KEY : planned task description
(Use "Continue working on same tasks" if user doesn't mention tomorrow)

\`BLOCKER\`
• blocker description
(Use "NA" if no blockers mentioned)

Output format for teamsFormat (Teams markdown):
**TODAY**
- TICKET-KEY : task description
- TICKET-KEY : task description

**TOMORROW**
- TICKET-KEY : planned task description
(Use "Continue working on same tasks" if user doesn't mention tomorrow)

**BLOCKER**
- blocker description
(Use "NA" if no blockers mentioned)${repeatContext}`;
}

export function buildUserMessage(transcript: string): string {
  return `Parse this daily update transcript:\n\n${transcript}`;
}

export const PARSE_RESULT_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    tasks: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          description: { type: "string" as const },
          issueKey: { type: "string" as const },
          timeEstimate: { type: "string" as const },
        },
        required: ["description"],
      },
    },
    blockers: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    timeEntries: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          issueKey: { type: "string" as const },
          timeSpentSecs: { type: "number" as const },
          started: { type: "string" as const },
          comment: { type: "string" as const },
          isRepeat: { type: "boolean" as const },
        },
        required: ["issueKey", "timeSpentSecs", "started", "comment", "isRepeat"],
      },
    },
    tomorrowTasks: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          description: { type: "string" as const },
          issueKey: { type: "string" as const },
        },
        required: ["description"],
      },
    },
    slackFormat: { type: "string" as const },
    teamsFormat: { type: "string" as const },
  },
  required: ["tasks", "blockers", "timeEntries", "tomorrowTasks", "slackFormat", "teamsFormat"],
};
