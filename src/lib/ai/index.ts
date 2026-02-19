import { prisma } from "@/lib/prisma";
import type { AIParseProvider } from "./types";
import type { AIProvider } from "@/types";

export async function getAIProvider(): Promise<AIParseProvider> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "app-settings" },
  });

  const provider = (settings?.aiProvider ?? "local-claude") as AIProvider;

  switch (provider) {
    case "gemini": {
      const apiKey = settings?.geminiApiKey;
      if (!apiKey) {
        throw new Error("Gemini API key not configured. Add it in Settings.");
      }
      const { GeminiProvider } = await import("./gemini-provider");
      return new GeminiProvider(apiKey);
    }

    case "claude-api": {
      const apiKey = settings?.claudeApiKey;
      if (!apiKey) {
        throw new Error("Anthropic API key not configured. Add it in Settings.");
      }
      const { ClaudeAPIProvider } = await import("./claude-api-provider");
      return new ClaudeAPIProvider(apiKey);
    }

    case "local-claude": {
      const { LocalClaudeProvider } = await import("./local-claude-provider");
      return new LocalClaudeProvider();
    }

    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export type { AIParseProvider } from "./types";
