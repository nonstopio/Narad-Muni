import { spawn } from "child_process";
import { prisma } from "@/lib/prisma";
import type { AIProvider } from "@/types";
import { buildIssueSystemPrompt, buildIssueUserMessage } from "./issue-prompt";

export interface EnrichedIssue {
  title: string;
  body: string;
}

export async function enrichIssueDescription(
  title: string,
  description: string
): Promise<EnrichedIssue> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "app-settings" },
  });

  const provider = (settings?.aiProvider ?? "local-claude") as AIProvider;
  const systemPrompt = buildIssueSystemPrompt();
  const userMessage = buildIssueUserMessage(title, description);

  console.log(`[Narada → Issue Enrichment] Using provider: ${provider}`);

  let rawOutput: string;

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
        rawOutput = textBlock.text;
        break;
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
        rawOutput = result.response.text();
        break;
      }

      case "local-claude": {
        rawOutput = await spawnCli("claude", [
          "--print",
          "--no-session-persistence",
          "--model", "sonnet",
          "--tools", "",
          "--append-system-prompt", systemPrompt,
          "--max-budget-usd", "0.50",
        ], userMessage);
        break;
      }

      case "local-cursor": {
        const combined = `${systemPrompt}\n\n${userMessage}`;
        rawOutput = await spawnCli("agent", ["--trust", "-p", combined]);
        break;
      }

      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  } catch (err) {
    console.error("[Narada → Issue Enrichment] AI enrichment failed, using raw description:", err);
    return { title, body: description.trim() || "No description provided." };
  }

  return parseEnrichedOutput(rawOutput, title);
}

function parseEnrichedOutput(raw: string, fallbackTitle: string): EnrichedIssue {
  // Strip any preamble before "TITLE:"
  const titleIdx = raw.indexOf("TITLE:");
  const cleaned = titleIdx >= 0 ? raw.slice(titleIdx) : raw;

  // Split on the "---" separator between title and body
  const separatorMatch = cleaned.match(/^TITLE:\s*(.+)\n---\n([\s\S]*)$/);
  if (separatorMatch) {
    return {
      title: separatorMatch[1].trim(),
      body: separatorMatch[2].trim(),
    };
  }

  // Fallback: try to extract just a TITLE: line
  const titleLineMatch = cleaned.match(/^TITLE:\s*(.+)\n([\s\S]*)$/);
  if (titleLineMatch) {
    return {
      title: titleLineMatch[1].trim(),
      body: titleLineMatch[2].replace(/^---\s*/, "").trim(),
    };
  }

  // No parseable structure — use raw as body
  return { title: fallbackTitle, body: cleaned.trim() };
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
