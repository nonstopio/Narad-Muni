import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AIProvider } from "@/types";

const VALID_PROVIDERS: AIProvider[] = ["gemini", "claude-api", "local-claude", "local-cursor"];
const MASKED = "••••••••";

function maskKey(key: string | null | undefined): string {
  if (!key) return "";
  if (key.length <= 8) return MASKED;
  return key.slice(0, 4) + MASKED + key.slice(-4);
}

export async function GET() {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "app-settings" },
  });

  return NextResponse.json({
    aiProvider: settings?.aiProvider ?? "local-claude",
    geminiApiKey: maskKey(settings?.geminiApiKey),
    claudeApiKey: maskKey(settings?.claudeApiKey),
    deepgramApiKey: maskKey(settings?.deepgramApiKey),
    hasGeminiKey: !!settings?.geminiApiKey,
    hasClaudeKey: !!settings?.claudeApiKey,
    hasDeepgramKey: !!settings?.deepgramApiKey,
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { aiProvider, geminiApiKey, claudeApiKey, deepgramApiKey, removeKeys } = body;

  if (aiProvider && !VALID_PROVIDERS.includes(aiProvider)) {
    return NextResponse.json(
      { error: `Invalid AI provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
      { status: 400 }
    );
  }

  // Build update data, skipping masked values to prevent overwrites
  const updateData: Record<string, string | null> = {};
  if (aiProvider) updateData.aiProvider = aiProvider;
  if (geminiApiKey && !geminiApiKey.includes(MASKED)) {
    updateData.geminiApiKey = geminiApiKey;
  }
  if (claudeApiKey && !claudeApiKey.includes(MASKED)) {
    updateData.claudeApiKey = claudeApiKey;
  }
  if (deepgramApiKey && !deepgramApiKey.includes(MASKED)) {
    updateData.deepgramApiKey = deepgramApiKey;
  }

  // Explicit key removal
  const keysToRemove: string[] = Array.isArray(removeKeys) ? removeKeys : [];
  for (const key of keysToRemove) {
    if (["geminiApiKey", "claudeApiKey", "deepgramApiKey"].includes(key)) {
      updateData[key] = null;
    }
  }

  await prisma.appSettings.upsert({
    where: { id: "app-settings" },
    update: updateData,
    create: {
      id: "app-settings",
      aiProvider: aiProvider ?? "local-claude",
      geminiApiKey: geminiApiKey && !geminiApiKey.includes(MASKED) ? geminiApiKey : undefined,
      claudeApiKey: claudeApiKey && !claudeApiKey.includes(MASKED) ? claudeApiKey : undefined,
      deepgramApiKey: deepgramApiKey && !deepgramApiKey.includes(MASKED) ? deepgramApiKey : undefined,
    },
  });

  // Return updated state
  const settings = await prisma.appSettings.findUnique({
    where: { id: "app-settings" },
  });

  return NextResponse.json({
    aiProvider: settings?.aiProvider ?? "local-claude",
    geminiApiKey: maskKey(settings?.geminiApiKey),
    claudeApiKey: maskKey(settings?.claudeApiKey),
    deepgramApiKey: maskKey(settings?.deepgramApiKey),
    hasGeminiKey: !!settings?.geminiApiKey,
    hasClaudeKey: !!settings?.claudeApiKey,
    hasDeepgramKey: !!settings?.deepgramApiKey,
  });
}
