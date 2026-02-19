import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

function getConfigPath(): string | null {
  const userDataDir = process.env.NARADA_USER_DATA_DIR;
  if (!userDataDir) return null;
  return path.join(userDataDir, "narada.config.json");
}

export async function GET() {
  const configPath = getConfigPath();
  if (!configPath) {
    return NextResponse.json(
      { error: "Not running in Electron" },
      { status: 404 }
    );
  }

  try {
    let config = { version: 1, database: {}, window: {} };
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }

    const dbPath =
      (config as { database?: { path?: string } }).database?.path ||
      path.join(process.env.NARADA_USER_DATA_DIR!, "narada.db");

    return NextResponse.json({
      isElectron: true,
      dbPath,
      config,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to read config" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const configPath = getConfigPath();
  if (!configPath) {
    return NextResponse.json(
      { error: "Not running in Electron" },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    const { dbPath } = body;

    let config: Record<string, unknown> = { version: 1, database: {}, window: {} };
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }

    config.database = { path: dbPath };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      message: "Database path updated. Restart Narada for changes to take effect.",
      dbPath,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to update config" },
      { status: 500 }
    );
  }
}
