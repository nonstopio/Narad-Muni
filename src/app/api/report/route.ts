import { NextRequest, NextResponse } from "next/server";
import { enrichIssueDescription } from "@/lib/ai/enrich-issue";
import { getLogContents } from "@/lib/logger";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { settingsDoc } from "@/lib/firestore-helpers";

const GITHUB_REPO = "nonstopio/Narad-Muni";
const MAX_URL_LENGTH = 8000;

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    const { title, description = "", attachLogs = true } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Read AI settings
    const settingsSnap = await settingsDoc(user.uid).get();

    const enriched = await enrichIssueDescription(
      title.trim(),
      typeof description === "string" ? description : "",
      settingsSnap.data()
    );

    const enrichedTitle = enriched.title;
    const enrichedBody = enriched.body;

    let issueBody = enrichedBody;

    if (attachLogs) {
      issueBody = appendLogs(issueBody, 100);
    }

    let issueUrl = buildGitHubUrl(enrichedTitle, issueBody);

    if (issueUrl.length > MAX_URL_LENGTH && attachLogs) {
      issueBody = appendLogs(enrichedBody, 50);
      issueUrl = buildGitHubUrl(enrichedTitle, issueBody);
    }

    if (issueUrl.length > MAX_URL_LENGTH && attachLogs) {
      issueBody = appendLogs(enrichedBody, 20);
      issueUrl = buildGitHubUrl(enrichedTitle, issueBody);
    }

    if (issueUrl.length > MAX_URL_LENGTH) {
      issueUrl = buildGitHubUrl(enrichedTitle, enrichedBody);
    }

    return NextResponse.json({ success: true, issueUrl });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada → Report] Failed to generate issue URL:", error);
    return NextResponse.json({ error: "Failed to prepare the petition" }, { status: 500 });
  }
}

function appendLogs(body: string, maxEntries: number): string {
  const logs = getLogContents(maxEntries);
  if (!logs) return body;
  return `${body}\n\n<details>\n<summary>Application Logs</summary>\n\n\`\`\`\n${logs}\n\`\`\`\n\n</details>`;
}

function buildGitHubUrl(title: string, body: string): string {
  const params = new URLSearchParams({ title, body, labels: "bug" });
  return `https://github.com/${GITHUB_REPO}/issues/new?${params.toString()}`;
}
