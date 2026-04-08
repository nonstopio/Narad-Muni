import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getDb, readUserId, appendToDraft, getDraft, replaceDraft, getUpdateForDate } from "./db";

const server = new McpServer({
  name: "narada",
  version: "1.0.0",
});

server.tool(
  "log_work",
  "Log a completed work entry to Narad Muni. The entry is saved as a draft — open Narad Muni to preview and publish to Slack, Teams, and Jira.",
  {
    message: z.string().describe("What you worked on, e.g. 'Implemented user auth flow'"),
    ticket: z.string().optional().describe("Jira ticket key, e.g. 'PROJ-123'"),
    date: z.string().optional().describe("Date in YYYY-MM-DD format, defaults to today"),
  },
  async ({ message, ticket, date }) => {
    try {
      const dateStr = date || new Date().toISOString().slice(0, 10);
      process.stderr.write(`[narada-mcp] log_work: date=${dateStr} message="${message}"${ticket ? ` ticket=${ticket}` : ""}\n`);

      // Format: "- PROJ-123: Implemented user auth flow" or "- Implemented user auth flow"
      const entryLine = ticket ? `- ${ticket}: ${message}` : `- ${message}`;

      const userId = readUserId();
      const db = getDb();
      const draftContent = await appendToDraft(db, userId, dateStr, entryLine);

      return {
        content: [
          {
            type: "text" as const,
            text: `Logged to ${dateStr} draft:\n${entryLine}\n\nFull draft:\n${draftContent}`,
          },
        ],
      };
    } catch (err) {
      process.stderr.write(`[narada-mcp] log_work error: ${err instanceof Error ? err.message : String(err)}\n`);
      const message_ = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message_}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_draft",
  "Get the current draft/work log for a given date. Returns all entries logged so far and whether an update has already been published (with platform statuses).",
  {
    date: z.string().optional().describe("Date in YYYY-MM-DD format, defaults to today"),
  },
  async ({ date }) => {
    try {
      const dateStr = date || new Date().toISOString().slice(0, 10);
      process.stderr.write(`[narada-mcp] get_draft: date=${dateStr}\n`);

      const userId = readUserId();
      const db = getDb();
      const [content, updateStatus] = await Promise.all([
        getDraft(db, userId, dateStr),
        getUpdateForDate(db, userId, dateStr),
      ]);

      let text = "";

      if (content) {
        text += `Draft for ${dateStr}:\n${content}`;
      } else {
        text += `No entries logged for ${dateStr} yet.`;
      }

      if (updateStatus.exists) {
        text += `\n\nPublish status:`;
        text += `\n  Slack: ${updateStatus.slackStatus || "N/A"}`;
        text += `\n  Teams: ${updateStatus.teamsStatus || "N/A"}`;
        text += `\n  Jira: ${updateStatus.jiraStatus || "N/A"}`;
        if (updateStatus.workLogTotal) {
          text += ` (${updateStatus.workLogPosted}/${updateStatus.workLogTotal} worklogs posted)`;
        }
      } else {
        text += `\n\nNot yet published.`;
      }

      return {
        content: [{ type: "text" as const, text }],
      };
    } catch (err) {
      process.stderr.write(`[narada-mcp] get_draft error: ${err instanceof Error ? err.message : String(err)}\n`);
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "edit_draft",
  "Replace the entire draft content for a date. Use get_draft first to see current content, then pass the corrected full text. Useful for fixing typos, wrong ticket keys, or reorganizing entries.",
  {
    content: z.string().describe("The full replacement draft text"),
    date: z.string().optional().describe("Date in YYYY-MM-DD format, defaults to today"),
  },
  async ({ content, date }) => {
    try {
      const dateStr = date || new Date().toISOString().slice(0, 10);
      process.stderr.write(`[narada-mcp] edit_draft: date=${dateStr} content_length=${content.length}\n`);

      const userId = readUserId();
      const db = getDb();

      if (!content.trim()) {
        return {
          content: [{ type: "text" as const, text: `Cannot set draft to empty. Use the Narada app to delete drafts.` }],
          isError: true,
        };
      }

      await replaceDraft(db, userId, dateStr, content);

      return {
        content: [{ type: "text" as const, text: `Draft for ${dateStr} updated:\n${content}` }],
      };
    } catch (err) {
      process.stderr.write(`[narada-mcp] edit_draft error: ${err instanceof Error ? err.message : String(err)}\n`);
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_status",
  "Check the publish status of an update for a given date. Shows which platforms succeeded, failed, or were skipped, and Jira worklog counts.",
  {
    date: z.string().optional().describe("Date in YYYY-MM-DD format, defaults to today"),
  },
  async ({ date }) => {
    try {
      const dateStr = date || new Date().toISOString().slice(0, 10);
      process.stderr.write(`[narada-mcp] get_status: date=${dateStr}\n`);

      const userId = readUserId();
      const db = getDb();
      const status = await getUpdateForDate(db, userId, dateStr);

      if (!status.exists) {
        return {
          content: [{ type: "text" as const, text: `No update published for ${dateStr} yet.` }],
        };
      }

      let text = `Update for ${dateStr}:`;
      text += `\n  Slack: ${status.slackStatus || "N/A"}`;
      text += `\n  Teams: ${status.teamsStatus || "N/A"}`;
      text += `\n  Jira: ${status.jiraStatus || "N/A"}`;
      if (status.workLogTotal) {
        text += ` (${status.workLogPosted}/${status.workLogTotal} worklogs posted)`;
      }

      const failed = [
        status.slackStatus === "FAILED" && "Slack",
        status.teamsStatus === "FAILED" && "Teams",
        status.jiraStatus === "FAILED" && "Jira",
      ].filter(Boolean);

      if (failed.length > 0) {
        text += `\n\nTo retry failed platforms, open Narada.`;
      }

      return {
        content: [{ type: "text" as const, text }],
      };
    } catch (err) {
      process.stderr.write(`[narada-mcp] get_status error: ${err instanceof Error ? err.message : String(err)}\n`);
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[narada-mcp] Server started (v${require("../package.json").version})\n`);
}

main().catch((err) => {
  process.stderr.write(`[narada-mcp] Fatal: ${err}\n`);
  process.exit(1);
});
