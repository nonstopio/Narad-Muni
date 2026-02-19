import { spawn } from "child_process";
import type { ClaudeParseResult } from "@/types/claude";
import type { AIParseProvider, RepeatEntryInput } from "./types";
import { buildSystemPrompt, buildUserMessage, PARSE_RESULT_JSON_SCHEMA } from "./prompt";

const TIMEOUT_MS = 120_000;

/**
 * Build a self-contained prompt for the CLI that combines system prompt,
 * user message, and JSON output requirement (recency bias).
 */
function buildCliPrompt(
  transcript: string,
  date: string,
  repeatEntries: RepeatEntryInput[]
): string {
  const systemPrompt = buildSystemPrompt(date, repeatEntries);
  const userMessage = buildUserMessage(transcript);

  return `${systemPrompt}

${userMessage}

Respond with ONLY a valid JSON object. No explanation, no markdown, no code fences, no text before or after. Just the raw JSON object matching this exact schema:
${JSON.stringify(PARSE_RESULT_JSON_SCHEMA, null, 2)}`;
}

export class LocalClaudeProvider implements AIParseProvider {
  name = "Local Claude (CLI)";

  async parseTranscript(
    transcript: string,
    date: string,
    repeatEntries: RepeatEntryInput[]
  ): Promise<ClaudeParseResult> {
    const stdinContent = buildCliPrompt(transcript, date, repeatEntries);

    const appendPrompt =
      "You are a JSON-only output machine. You MUST respond with ONLY a raw JSON object. " +
      "No natural language, no explanation, no markdown fences, no text before or after the JSON. " +
      "Your entire response must be parseable by JSON.parse().";

    const args = [
      "--print",
      "--output-format", "json",
      "--no-session-persistence",
      "--model", "sonnet",
      "--tools", "",
      "--append-system-prompt", appendPrompt,
      "--max-budget-usd", "1.00",
    ];

    console.log(`[Narada → Local Claude] Spawning CLI — args=${JSON.stringify(args)}, stdin=${stdinContent.length} chars`);

    const stdout = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];
      let settled = false;

      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true;
          fn();
        }
      };

      const proc = spawn("claude", args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      proc.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

      proc.on("error", (err: NodeJS.ErrnoException) => {
        settle(() => {
          if (err.code === "ENOENT") {
            reject(
              new Error(
                "Claude CLI not found. Install it from https://claude.ai/code or select a different AI provider in Settings."
              )
            );
          } else {
            reject(new Error(`Claude CLI error: ${err.message}`));
          }
        });
      });

      proc.on("close", (code) => {
        settle(() => {
          const out = Buffer.concat(chunks).toString("utf-8");
          const err = Buffer.concat(errChunks).toString("utf-8");

          console.log(`[Narada → Local Claude] Process exited — code=${code}, stdout=${out.length} chars`);
          if (err) {
            console.log(`[Narada → Local Claude] stderr: ${err}`);
          }

          if (code !== 0 && !out) {
            reject(new Error(`Claude CLI exited with code ${code}: ${err || "unknown error"}`));
            return;
          }
          resolve(out);
        });
      });

      // Pipe the self-contained prompt via stdin and close it
      proc.stdin.write(stdinContent);
      proc.stdin.end();

      // Handle timeout
      const timer = setTimeout(() => {
        proc.kill("SIGTERM");
        settle(() => reject(new Error("Claude CLI timed out after 2 minutes")));
      }, TIMEOUT_MS);

      proc.on("close", () => clearTimeout(timer));
    });

    // CLI with --output-format json returns a JSON envelope
    const envelope = JSON.parse(stdout);

    console.log(
      `[Narada → Local Claude] Envelope — subtype=${envelope.subtype}, result_type=${typeof envelope.result}, result_length=${
        typeof envelope.result === "string" ? envelope.result.length : "N/A"
      }`
    );

    if (envelope.is_error || (envelope.subtype && envelope.subtype !== "success")) {
      throw new Error(
        `Claude CLI failed (${envelope.subtype || "error"}): ${
          envelope.result || "No output. Check CLI configuration."
        }`
      );
    }

    if (!envelope.result) {
      throw new Error("Claude CLI returned no result");
    }

    // Strategy 1: result is already a parsed object
    if (typeof envelope.result === "object") {
      console.log("[Narada → Local Claude] Parsed result (object)");
      return envelope.result as ClaudeParseResult;
    }

    // Strategy 2: result is a clean JSON string
    const resultStr = envelope.result as string;
    try {
      const parsed = JSON.parse(resultStr);
      console.log("[Narada → Local Claude] Parsed result (direct JSON.parse)");
      return parsed as ClaudeParseResult;
    } catch {
      // Not clean JSON, try extraction
    }

    // Strategy 3: extract JSON object from surrounding text/code fences
    const jsonMatch = resultStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log("[Narada → Local Claude] Parsed result (regex extraction)");
        return parsed as ClaudeParseResult;
      } catch {
        // Matched braces but invalid JSON inside
      }
    }

    // All strategies failed
    console.error(
      `[Narada → Local Claude] JSON extraction failed — raw result: ${resultStr.slice(0, 300)}`
    );
    throw new Error(
      `Claude CLI did not return valid JSON. Got: ${resultStr.slice(0, 300)}`
    );
  }
}
