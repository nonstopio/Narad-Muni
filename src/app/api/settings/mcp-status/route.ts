import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";

const CLAUDE_CONFIG_PATH = path.join(os.homedir(), ".claude.json");
const MCP_SERVER_NAME = "narada";

interface ClaudeConfig {
  mcpServers?: Record<string, {
    command: string;
    args?: string[];
  }>;
  [key: string]: unknown;
}

/**
 * GET — Returns MCP registration status from ~/.claude.json
 */
export async function GET() {
  try {
    const result = {
      registered: false,
      binaryPath: null as string | null,
      configPath: CLAUDE_CONFIG_PATH,
      binaryExists: false,
    };

    if (fs.existsSync(CLAUDE_CONFIG_PATH)) {
      const raw = fs.readFileSync(CLAUDE_CONFIG_PATH, "utf-8");
      const config: ClaudeConfig = JSON.parse(raw);
      const entry = config.mcpServers?.[MCP_SERVER_NAME];
      if (entry) {
        result.registered = true;
        result.binaryPath = entry.command;
        result.binaryExists = !!entry.command && fs.existsSync(entry.command);
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[API /settings/mcp-status GET] Failed:", err);
    return NextResponse.json(
      { error: "Failed to read MCP status" },
      { status: 500 }
    );
  }
}

/**
 * POST — Test MCP health by spawning the binary with --mcp and
 * sending an MCP initialize request over stdio.
 */
export async function POST() {
  try {
    // Read the registered binary path
    if (!fs.existsSync(CLAUDE_CONFIG_PATH)) {
      return NextResponse.json({ success: false, error: "Claude config not found" });
    }

    const raw = fs.readFileSync(CLAUDE_CONFIG_PATH, "utf-8");
    const config: ClaudeConfig = JSON.parse(raw);
    const entry = config.mcpServers?.[MCP_SERVER_NAME];

    if (!entry?.command) {
      return NextResponse.json({ success: false, error: "MCP server not registered" });
    }

    if (!fs.existsSync(entry.command)) {
      return NextResponse.json({ success: false, error: `Binary not found: ${entry.command}` });
    }

    const result = await testMcpServer(entry.command, entry.args || ["--mcp"]);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[API /settings/mcp-status POST] Failed:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}

function testMcpServer(
  command: string,
  args: string[]
): Promise<{ success: boolean; tools?: string[]; error?: string }> {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (result: { success: boolean; tools?: string[]; error?: string }) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      child.kill();
      resolve(result);
    };

    const timer = setTimeout(() => {
      done({ success: false, error: "Timeout: server did not respond within 10 seconds" });
    }, 10000);

    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    let sentInit = false;
    let sentList = false;

    child.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      // Once the server writes to stderr, it's ready — send the init request
      if (!sentInit && text.includes("[narada-mcp]")) {
        sentInit = true;
        const initReq = JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "narada-health-check", version: "1.0.0" },
          },
        });
        child.stdin.write(initReq + "\n");
      }
    });

    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      // Parse each newline-delimited JSON message
      const lines = text.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue; // Skip non-JSON output
        }
        if (msg.id === 1 && msg.result && !sentList) {
          // Initialize response — now list tools
          sentList = true;
          const listReq = JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "tools/list",
            params: {},
          });
          child.stdin.write(listReq + "\n");
        }
        if (msg.id === 2 && msg.result) {
          const tools = (msg.result.tools || []).map((t: { name: string }) => t.name);
          done({ success: true, tools });
        }
      }
    });

    child.on("error", (err) => {
      done({ success: false, error: `Failed to spawn: ${err.message}` });
    });

    child.on("exit", (code) => {
      if (code !== null && code !== 0) {
        done({ success: false, error: `Process exited with code ${code}` });
      }
    });
  });
}
