import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AIProvider } from "@/types";

const VALID_PROVIDERS: AIProvider[] = ["gemini", "claude-api", "local-claude"];
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
    hasGeminiKey: !!settings?.geminiApiKey || !!process.env.GEMINI_API_KEY,
    hasClaudeKey: !!settings?.claudeApiKey || !!process.env.ANTHROPIC_API_KEY,
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { aiProvider, geminiApiKey, claudeApiKey } = body;

  if (aiProvider && !VALID_PROVIDERS.includes(aiProvider)) {
    return NextResponse.json(
      { error: `Invalid AI provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
      { status: 400 }
    );
  }

  // Build update data, skipping masked values to prevent overwrites
  const updateData: Record<string, string> = {};
  if (aiProvider) updateData.aiProvider = aiProvider;
  if (geminiApiKey && !geminiApiKey.includes(MASKED)) {
    updateData.geminiApiKey = geminiApiKey;
  }
  if (claudeApiKey && !claudeApiKey.includes(MASKED)) {
    updateData.claudeApiKey = claudeApiKey;
  }

  await prisma.appSettings.upsert({
    where: { id: "app-settings" },
    update: updateData,
    create: {
      id: "app-settings",
      aiProvider: aiProvider ?? "local-claude",
      geminiApiKey: geminiApiKey && !geminiApiKey.includes(MASKED) ? geminiApiKey : undefined,
      claudeApiKey: claudeApiKey && !claudeApiKey.includes(MASKED) ? claudeApiKey : undefined,
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
    hasGeminiKey: !!settings?.geminiApiKey || !!process.env.GEMINI_API_KEY,
    hasClaudeKey: !!settings?.claudeApiKey || !!process.env.ANTHROPIC_API_KEY,
  });
}
