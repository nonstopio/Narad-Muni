import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { prisma } from "@/lib/prisma";
import type { AIProvider } from "@/types";

const VALID_PROVIDERS: AIProvider[] = ["gemini", "claude-api", "local-claude", "local-cursor"];
const CLI_TIMEOUT_MS = 15_000;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { provider, geminiApiKey, claudeApiKey, useStoredKey } = body as {
    provider: AIProvider;
    geminiApiKey?: string;
    claudeApiKey?: string;
    useStoredKey?: boolean;
  };

  if (!provider || !VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { success: false, error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    switch (provider) {
      case "gemini": {
        let apiKey = geminiApiKey;
        if (useStoredKey) {
          const settings = await prisma.appSettings.findUnique({ where: { id: "app-settings" } });
          apiKey = settings?.geminiApiKey ?? undefined;
        }
        if (!apiKey) {
          return NextResponse.json({ success: false, error: "No Gemini API key provided" }, { status: 400 });
        }
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        await model.generateContent("Say hello in one word");
        break;
      }

      case "claude-api": {
        let apiKey = claudeApiKey;
        if (useStoredKey) {
          const settings = await prisma.appSettings.findUnique({ where: { id: "app-settings" } });
          apiKey = settings?.claudeApiKey ?? undefined;
        }
        if (!apiKey) {
          return NextResponse.json({ success: false, error: "No Anthropic API key provided" }, { status: 400 });
        }
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic({ apiKey });
        await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 10,
          messages: [{ role: "user", content: "Say hello in one word" }],
        });
        break;
      }

      case "local-claude": {
        await spawnTest("claude", [
          "--print",
          "--no-session-persistence",
          "--model", "sonnet",
          "--max-budget-usd", "0.01",
          "Say hello in one word",
        ]);
        break;
      }

      case "local-cursor": {
        await spawnTest("agent", ["--trust", "-p", "Say hello in one word"]);
        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Test AI] ${provider} failed:`, message);
    return NextResponse.json({ success: false, error: message });
  }
}

function spawnTest(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let settled = false;

    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };

    const proc = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

    proc.on("error", (err: NodeJS.ErrnoException) => {
      settle(() => {
        if (err.code === "ENOENT") {
          reject(new Error(`${command} CLI not found. Make sure it is installed and available in your PATH.`));
        } else {
          reject(new Error(`${command} CLI error: ${err.message}`));
        }
      });
    });

    proc.on("close", (code) => {
      settle(() => {
        const out = Buffer.concat(chunks).toString("utf-8");
        const err = Buffer.concat(errChunks).toString("utf-8");

        if (code !== 0 && !out) {
          reject(new Error(`${command} CLI exited with code ${code}: ${err || "unknown error"}`));
          return;
        }
        resolve(out);
      });
    });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      settle(() => reject(new Error(`${command} CLI timed out after ${CLI_TIMEOUT_MS / 1000}s`)));
    }, CLI_TIMEOUT_MS);

    proc.on("close", () => clearTimeout(timer));
  });
}
