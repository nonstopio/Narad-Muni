import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { settingsDoc } from "@/lib/firestore-helpers";
import type { AIProvider } from "@/types";

const VALID_PROVIDERS: AIProvider[] = ["gemini", "claude-api", "local-claude", "local-cursor"];
const MASKED = "••••••••";

function maskKey(key: string | null | undefined): string {
  if (!key) return "";
  if (key.length <= 8) return MASKED;
  return key.slice(0, 4) + MASKED + key.slice(-4);
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const doc = await settingsDoc(user.uid).get();
    const settings = doc.data();

    return NextResponse.json({
      aiProvider: settings?.aiProvider ?? "local-claude",
      geminiApiKey: maskKey(settings?.geminiApiKey),
      claudeApiKey: maskKey(settings?.claudeApiKey),
      deepgramApiKey: maskKey(settings?.deepgramApiKey),
      hasGeminiKey: !!settings?.geminiApiKey,
      hasClaudeKey: !!settings?.claudeApiKey,
      hasDeepgramKey: !!settings?.deepgramApiKey,
    });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const body = await request.json();
    const { aiProvider, geminiApiKey, claudeApiKey, deepgramApiKey, removeKeys } = body;

    if (aiProvider && !VALID_PROVIDERS.includes(aiProvider)) {
      return NextResponse.json(
        { error: `Invalid AI provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
        { status: 400 }
      );
    }

    const updateData: Record<string, string | null> = {};
    if (aiProvider) updateData.aiProvider = aiProvider;
    if (geminiApiKey && !geminiApiKey.includes(MASKED)) updateData.geminiApiKey = geminiApiKey;
    if (claudeApiKey && !claudeApiKey.includes(MASKED)) updateData.claudeApiKey = claudeApiKey;
    if (deepgramApiKey && !deepgramApiKey.includes(MASKED)) updateData.deepgramApiKey = deepgramApiKey;

    const keysToRemove: string[] = Array.isArray(removeKeys) ? removeKeys : [];
    for (const key of keysToRemove) {
      if (["geminiApiKey", "claudeApiKey", "deepgramApiKey"].includes(key)) {
        updateData[key] = null;
      }
    }

    const ref = settingsDoc(user.uid);
    await ref.set(updateData, { merge: true });

    const doc = await ref.get();
    const settings = doc.data();

    return NextResponse.json({
      aiProvider: settings?.aiProvider ?? "local-claude",
      geminiApiKey: maskKey(settings?.geminiApiKey),
      claudeApiKey: maskKey(settings?.claudeApiKey),
      deepgramApiKey: maskKey(settings?.deepgramApiKey),
      hasGeminiKey: !!settings?.geminiApiKey,
      hasClaudeKey: !!settings?.claudeApiKey,
      hasDeepgramKey: !!settings?.deepgramApiKey,
    });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
