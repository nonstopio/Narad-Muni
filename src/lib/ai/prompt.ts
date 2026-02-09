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

  return `You are a daily standup parser for a developer productivity tool called Narada. Parse the user's daily update transcript and extract structured data.

Date context: ${date}

Instructions:
- Extract discrete work tasks with descriptions and any Jira issue keys mentioned (format: PROJ-1234)
- Parse time references into durations in seconds (e.g., "3 hours" = 10800)
- Detect blockers from natural speech
- For time entries, use the date "${date}" combined with reasonable start times (working hours 10:00-20:00 IST). Each entry's "started" should be an ISO 8601 datetime string.
- Generate Slack mrkdwn format with Today/Blockers sections using * for bullet points
- Generate Teams markdown format with ## headings and - for bullet points
- Set isRepeat to false for all entries you extract (repeat entries are handled separately)${repeatContext}`;
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
    slackFormat: { type: "string" as const },
    teamsFormat: { type: "string" as const },
  },
  required: ["tasks", "blockers", "timeEntries", "slackFormat", "teamsFormat"],
};
