import { spawn } from "child_process";
import { prisma } from "@/lib/prisma";
import type { AIProvider } from "@/types";
import { buildIssueSystemPrompt, buildIssueUserMessage } from "./issue-prompt";

export async function enrichIssueDescription(
  title: string,
  description: string
): Promise<string> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "app-settings" },
  });

  const provider = (settings?.aiProvider ?? "local-claude") as AIProvider;
  const systemPrompt = buildIssueSystemPrompt();
  const userMessage = buildIssueUserMessage(title, description);

  console.log(`[Narada → Issue Enrichment] Using provider: ${provider}`);

  try {
    switch (provider) {
      case "claude-api": {
        const apiKey = settings?.claudeApiKey;
        if (!apiKey) throw new Error("Anthropic API key not configured");
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey });
        const response = await client.messages.create({
          model: "claude-sonnet-4-5-20250514",
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        });
        const textBlock = response.content.find((b) => b.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          throw new Error("No text response from Claude API");
        }
        return textBlock.text;
      }

      case "gemini": {
        const apiKey = settings?.geminiApiKey;
        if (!apiKey) throw new Error("Gemini API key not configured");
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: "gemini-2.0-flash",
          systemInstruction: systemPrompt,
        });
        const result = await model.generateContent(userMessage);
        return result.response.text();
      }

      case "local-claude": {
        return await spawnCli("claude", [
          "--print",
          "--no-session-persistence",
          "--model", "sonnet",
          "--tools", "",
          "--append-system-prompt", systemPrompt,
          "--max-budget-usd", "0.50",
        ], userMessage);
      }

      case "local-cursor": {
        const combined = `${systemPrompt}\n\n${userMessage}`;
        return await spawnCli("agent", ["--trust", "-p", combined]);
      }

      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  } catch (err) {
    console.error("[Narada → Issue Enrichment] AI enrichment failed, using raw description:", err);
    return description.trim() || "No description provided.";
  }
}

function spawnCli(
  command: string,
  args: string[],
  stdinContent?: string
): Promise<string> {
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
      stdio: [stdinContent ? "pipe" : "ignore", "pipe", "pipe"],
    });

    proc.stdout!.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr!.on("data", (chunk: Buffer) => errChunks.push(chunk));

    proc.on("error", (err: NodeJS.ErrnoException) => {
      settle(() => reject(new Error(`${command} CLI error: ${err.message}`)));
    });

    proc.on("close", (code) => {
      settle(() => {
        const out = Buffer.concat(chunks).toString("utf-8");
        const err = Buffer.concat(errChunks).toString("utf-8");

        if (code !== 0 && !out) {
          reject(new Error(`${command} exited with code ${code}: ${err || "unknown"}`));
          return;
        }

        // For claude --print (no --output-format json), output is plain text
        // For claude --print --output-format json, we need to unwrap the envelope
        if (command === "claude") {
          // --print without --output-format json returns plain text directly
          resolve(out.trim());
        } else {
          resolve(out.trim());
        }
      });
    });

    if (stdinContent && proc.stdin) {
      proc.stdin.write(stdinContent);
      proc.stdin.end();
    }

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      settle(() => reject(new Error(`${command} CLI timed out after 2 minutes`)));
    }, 120_000);

    proc.on("close", () => clearTimeout(timer));
  });
}
