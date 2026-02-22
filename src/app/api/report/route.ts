import { NextRequest, NextResponse } from "next/server";
import { enrichIssueDescription } from "@/lib/ai/enrich-issue";
import { getLogContents } from "@/lib/logger";

const GITHUB_REPO = "nonstopio/Narad-Muni";
const MAX_URL_LENGTH = 8000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description = "", attachLogs = true } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Enrich via AI (graceful fallback on failure)
    const enrichedBody = await enrichIssueDescription(
      title.trim(),
      typeof description === "string" ? description : ""
    );

    // Build issue body
    let issueBody = enrichedBody;

    // Attach logs if requested
    if (attachLogs) {
      issueBody = appendLogs(issueBody, 100);
    }

    // Construct GitHub URL, trimming logs if too long
    let issueUrl = buildGitHubUrl(title.trim(), issueBody);

    if (issueUrl.length > MAX_URL_LENGTH && attachLogs) {
      issueBody = appendLogs(enrichedBody, 50);
      issueUrl = buildGitHubUrl(title.trim(), issueBody);
    }

    if (issueUrl.length > MAX_URL_LENGTH && attachLogs) {
      issueBody = appendLogs(enrichedBody, 20);
      issueUrl = buildGitHubUrl(title.trim(), issueBody);
    }

    if (issueUrl.length > MAX_URL_LENGTH) {
      // Drop logs entirely
      issueUrl = buildGitHubUrl(title.trim(), enrichedBody);
    }

    console.log(`[Narada → Report] Issue URL generated — length=${issueUrl.length} chars`);

    return NextResponse.json({ success: true, issueUrl });
  } catch (err) {
    console.error("[Narada → Report] Failed to generate issue URL:", err);
    return NextResponse.json(
      { error: "Failed to prepare the petition" },
      { status: 500 }
    );
  }
}

function appendLogs(body: string, maxEntries: number): string {
  const logs = getLogContents(maxEntries);
  if (!logs) return body;
  return `${body}\n\n<details>\n<summary>Application Logs</summary>\n\n\`\`\`\n${logs}\n\`\`\`\n\n</details>`;
}

function buildGitHubUrl(title: string, body: string): string {
  const params = new URLSearchParams({
    title,
    body,
    labels: "bug",
  });
  return `https://github.com/${GITHUB_REPO}/issues/new?${params.toString()}`;
}
