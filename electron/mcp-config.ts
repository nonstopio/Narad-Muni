import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CLAUDE_CONFIG_PATH = path.join(os.homedir(), ".claude.json");
const MCP_SERVER_NAME = "narada";

interface ClaudeConfig {
  mcpServers?: Record<string, {
    command: string;
    args?: string[];
    type?: string;
  }>;
  [key: string]: unknown;
}

/**
 * Auto-register the Narad Muni MCP server with Claude Code.
 * Writes/merges an entry into ~/.claude.json so Claude Code can spawn
 * the Electron binary with --mcp for stdio-based MCP communication.
 *
 * In dev mode the raw Electron binary needs the app directory as the
 * first argument: [".", "--mcp"]. In a packaged app the binary IS the
 * app so ["--mcp"] is sufficient.
 *
 * Safe: preserves all existing config keys and other MCP servers.
 * Non-fatal: all errors are caught and logged.
 */
export function registerMcpConfig(): void {
  try {
    const binaryPath = process.execPath;
    const isDev = !app.isPackaged;

    // In dev mode Electron needs the app directory path as first arg
    const args = isDev
      ? [path.resolve(__dirname, ".."), "--mcp"]
      : ["--mcp"];

    let config: ClaudeConfig = {};
    if (fs.existsSync(CLAUDE_CONFIG_PATH)) {
      const raw = fs.readFileSync(CLAUDE_CONFIG_PATH, "utf-8");
      config = JSON.parse(raw);
    }

    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    config.mcpServers[MCP_SERVER_NAME] = {
      command: binaryPath,
      args,
    };

    fs.writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
    console.log(`[Narada MCP] Registered in ${CLAUDE_CONFIG_PATH} (binary: ${binaryPath}, args: ${JSON.stringify(args)})`);
  } catch (err) {
    console.error("[Narada MCP] Failed to register MCP config:", err);
  }
}

export interface McpStatus {
  registered: boolean;
  binaryPath: string | null;
  configPath: string;
}

/**
 * Check whether Narad Muni is registered as an MCP server in ~/.claude.json.
 */
export function getMcpStatus(): McpStatus {
  const result: McpStatus = {
    registered: false,
    binaryPath: null,
    configPath: CLAUDE_CONFIG_PATH,
  };

  try {
    if (fs.existsSync(CLAUDE_CONFIG_PATH)) {
      const raw = fs.readFileSync(CLAUDE_CONFIG_PATH, "utf-8");
      const config: ClaudeConfig = JSON.parse(raw);
      const entry = config.mcpServers?.[MCP_SERVER_NAME];
      if (entry) {
        result.registered = true;
        result.binaryPath = entry.command;
      }
    }
  } catch (err) {
    console.error("[Narada MCP] Failed to read MCP status:", err);
  }

  return result;
}
