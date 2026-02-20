import { spawn } from "child_process";
import type { ClaudeParseResult } from "@/types/claude";
import type { AIParseProvider, RepeatEntryInput } from "./types";
import { buildSystemPrompt, buildUserMessage, PARSE_RESULT_JSON_SCHEMA } from "./prompt";

const TIMEOUT_MS = 120_000;

/**
 * Build a self-contained prompt for the Cursor agent CLI that combines
 * system prompt, user message, and JSON output requirement.
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

export class LocalCursorProvider implements AIParseProvider {
  name = "Local Cursor (CLI)";

  async parseTranscript(
    transcript: string,
    date: string,
    repeatEntries: RepeatEntryInput[]
  ): Promise<ClaudeParseResult> {
    const prompt = buildCliPrompt(transcript, date, repeatEntries);

    const args = ["--trust", "-p", prompt];

    console.log(
      `[Narada → Local Cursor] Spawning agent CLI — prompt=${prompt.length} chars`
    );

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

      const proc = spawn("agent", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      proc.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

      proc.on("error", (err: NodeJS.ErrnoException) => {
        settle(() => {
          if (err.code === "ENOENT") {
            reject(
              new Error(
                "Cursor agent CLI not found. Install it from Cursor settings or select a different AI provider in Settings."
              )
            );
          } else {
            reject(new Error(`Cursor agent CLI error: ${err.message}`));
          }
        });
      });

      proc.on("close", (code) => {
        settle(() => {
          const out = Buffer.concat(chunks).toString("utf-8");
          const err = Buffer.concat(errChunks).toString("utf-8");

          console.log(
            `[Narada → Local Cursor] Process exited — code=${code}, stdout=${out.length} chars`
          );
          if (err) {
            console.log(`[Narada → Local Cursor] stderr: ${err}`);
          }

          if (code !== 0 && !out) {
            reject(
              new Error(
                `Cursor agent CLI exited with code ${code}: ${err || "unknown error"}`
              )
            );
            return;
          }
          resolve(out);
        });
      });

      // Handle timeout
      const timer = setTimeout(() => {
        proc.kill("SIGTERM");
        settle(() =>
          reject(new Error("Cursor agent CLI timed out after 2 minutes"))
        );
      }, TIMEOUT_MS);

      proc.on("close", () => clearTimeout(timer));
    });

    // Strategy 1: direct JSON parse (output is clean JSON)
    try {
      const parsed = JSON.parse(stdout);
      console.log("[Narada → Local Cursor] Parsed result (direct JSON.parse)");
      return parsed as ClaudeParseResult;
    } catch {
      // Not clean JSON, try extraction
    }

    // Strategy 2: extract JSON object from surrounding text/code fences
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(
          "[Narada → Local Cursor] Parsed result (regex extraction)"
        );
        return parsed as ClaudeParseResult;
      } catch {
        // Matched braces but invalid JSON inside
      }
    }

    // All strategies failed
    console.error(
      `[Narada → Local Cursor] JSON extraction failed — raw output: ${stdout.slice(0, 300)}`
    );
    throw new Error(
      `Cursor agent CLI did not return valid JSON. Got: ${stdout.slice(0, 300)}`
    );
  }
}
