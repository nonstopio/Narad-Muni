import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";

export async function POST(request: NextRequest) {
  try {
    await verifyAuth(request);
    const body = await request.json();
    const { baseUrl, email, apiToken, projectKey } = body as {
      baseUrl?: string;
      email?: string;
      apiToken?: string;
      projectKey?: string;
    };

    if (!baseUrl?.trim() || !email?.trim() || !apiToken?.trim() || !projectKey?.trim()) {
      return NextResponse.json(
        { success: false, error: "All fields are required: Base URL, Email, API Token, and Project Key" },
        { status: 400 }
      );
    }

    const base = baseUrl.trim().replace(/\/+$/, "");
    const auth = Buffer.from(`${email.trim()}:${apiToken.trim()}`).toString("base64");
    const headers = {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    };

    // Step 1 — Auth check
    let displayName: string;
    try {
      const myselfRes = await fetch(`${base}/rest/api/3/myself`, { headers });

      if (myselfRes.status === 401 || myselfRes.status === 403) {
        return NextResponse.json({
          success: false,
          error: "Invalid credentials — check email and API token",
        });
      }

      if (!myselfRes.ok) {
        return NextResponse.json({
          success: false,
          error: `Jira returned status ${myselfRes.status} for auth check`,
        });
      }

      const myselfData = await myselfRes.json();
      displayName = myselfData.displayName || email.trim();
    } catch {
      return NextResponse.json({
        success: false,
        error: "Could not reach Jira — check the Base URL",
      });
    }

    // Step 2 — Project access check
    const key = projectKey.trim().toUpperCase();
    try {
      const issueRes = await fetch(`${base}/rest/api/3/issue/${key}-1`, { headers });

      if (issueRes.status === 404) {
        return NextResponse.json({
          success: false,
          error: `Authenticated as ${displayName}, but no access to ${key}-1 — check the project key or permissions`,
        });
      }

      if (issueRes.status === 401 || issueRes.status === 403) {
        return NextResponse.json({
          success: false,
          error: `Authenticated as ${displayName}, but no permission to access ${key}-1`,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Authenticated as ${displayName}. Access to ${key} verified.`,
      });
    } catch {
      return NextResponse.json({
        success: false,
        error: "Could not reach Jira — check the Base URL",
      });
    }
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada] Test Jira error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    );
  }
}
