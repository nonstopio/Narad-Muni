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

  // Calculate when repeat entries end to find earliest available slot
  const defaultStart = "10:00";
  const earliestAvailableTime = repeatEntries.length > 0
    ? repeatEntries.reduce((latest, e) => {
        const [h, m] = e.startTime.split(":").map(Number);
        const endMinutes = h * 60 + m + e.hours * 60;
        const endH = String(Math.floor(endMinutes / 60)).padStart(2, "0");
        const endM = String(endMinutes % 60).padStart(2, "0");
        const endTime = `${endH}:${endM}`;
        return endTime > latest ? endTime : latest;
      }, defaultStart)
    : defaultStart;

  return `You are a daily standup parser for a developer productivity tool called Narada. Parse the user's daily update transcript and extract structured data.

Date context: ${date}

Instructions:
- Extract discrete work tasks with descriptions and any Jira issue keys mentioned (format: PROJ-1234)
- Parse time references into durations in seconds (e.g., "3 hours" = 10800)
- Detect blockers from natural speech
- Extract tomorrow's planned tasks. If the user doesn't mention tomorrow, set tomorrowTasks to a single entry: "Continue working on same tasks"
- For time entries, use the date "${date}" combined with sequential start times beginning at ${earliestAvailableTime} (after repeat/fixed entries end). Each entry's "started" should be an ISO 8601 datetime string. Schedule entries sequentially — each entry starts when the previous one ends.
- Set isRepeat to false for all entries you extract (repeat entries are handled separately)

Time distribution rules:
- The total time for non-repeat entries should be at least ${remainingSecs} seconds (${(remainingSecs / 3600).toFixed(1)}h) to reach 8h total when combined with repeat entries
- Minimum time per entry is 1800 seconds (30 minutes)
- Round all time entries to the nearest 30-minute increment (1800s multiples)
- If the user specifies exact times for tasks, use those values (rounded to nearest 30-min)
- If the user does NOT specify exact times, infer relative weightage from each task's description:
  - High-effort indicators (assign more time): implementation, development, debugging, migration, refactoring, architecture, design, integration, investigation, POC, performance optimization
  - Medium-effort indicators (assign moderate time): code review, testing, writing tests, documentation, deployment, configuration, bug fix
  - Low-effort indicators (assign less time): standup, sync, quick fix, typo fix, minor update, status update, email, message, follow-up
  - If a task description mentions multiple sub-tasks or components, weight it higher
  - If the user emphasizes effort with words like "mostly", "spent a lot of time", "deep dive", "major", weight it higher; words like "quick", "small", "brief", "minor" mean lower weight
- After inferring relative weights, scale all entries so the total equals ${remainingSecs} seconds (${(remainingSecs / 3600).toFixed(1)}h), then round each to the nearest 30-min increment while preserving the 8h total

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
