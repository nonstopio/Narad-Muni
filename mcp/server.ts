import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { openDb, appendToDraft } from "./db";

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
    const dateStr = date || new Date().toISOString().slice(0, 10);

    // Format: "- PROJ-123: Implemented user auth flow" or "- Implemented user auth flow"
    const entryLine = ticket ? `- ${ticket}: ${message}` : `- ${message}`;

    let draftContent: string;
    const db = openDb();
    try {
      draftContent = appendToDraft(db, dateStr, entryLine);
    } finally {
      db.close();
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Logged to ${dateStr} draft:\n${entryLine}\n\nFull draft:\n${draftContent}`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[narada-mcp] Server started\n");
}

main().catch((err) => {
  process.stderr.write(`[narada-mcp] Fatal: ${err}\n`);
  process.exit(1);
});
