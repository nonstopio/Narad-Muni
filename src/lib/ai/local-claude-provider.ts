import { spawn } from "child_process";
import type { ClaudeParseResult } from "@/types/claude";
import type { AIParseProvider, RepeatEntryInput } from "./types";
import { buildSystemPrompt, buildUserMessage, PARSE_RESULT_JSON_SCHEMA } from "./prompt";

const TIMEOUT_MS = 120_000;

export class LocalClaudeProvider implements AIParseProvider {
  name = "Local Claude (CLI)";

  async parseTranscript(
    transcript: string,
    date: string,
    repeatEntries: RepeatEntryInput[]
  ): Promise<ClaudeParseResult> {
    const systemPrompt = buildSystemPrompt(date, repeatEntries) +
      "\n\nCRITICAL: You MUST respond with ONLY a raw JSON object. No explanation, no markdown, no code fences. Just the JSON.";

    const userMessage = buildUserMessage(transcript) +
      `\n\nRespond with ONLY a valid JSON object matching this exact schema:\n${JSON.stringify(PARSE_RESULT_JSON_SCHEMA, null, 2)}`;

    const args = [
      "--print",
      "--output-format", "json",
      "--no-session-persistence",
      "--model", "sonnet",
      "--tools", "",
      "--system-prompt", systemPrompt,
      "--max-budget-usd", "1.00",
    ];

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

          if (code !== 0 && !out) {
            reject(new Error(`Claude CLI exited with code ${code}: ${err || "unknown error"}`));
            return;
          }
          resolve(out);
        });
      });

      // Pipe the user message via stdin and close it
      proc.stdin.write(userMessage);
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

    // result may be a string (possibly with code fences) or already an object
    if (typeof envelope.result === "object") {
      return envelope.result as ClaudeParseResult;
    }

    // Extract JSON from the result string — strip code fences and any leading/trailing text
    const jsonMatch = envelope.result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(
        `Claude CLI did not return valid JSON. Got: ${envelope.result.slice(0, 200)}`
      );
    }

    return JSON.parse(jsonMatch[0]) as ClaudeParseResult;
  }
}
