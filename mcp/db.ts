import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import Database from "better-sqlite3";

/**
 * Resolve the path to Narad Muni's SQLite database.
 * Mirrors the logic from electron/dev-start.js and electron/config.ts.
 */
export function resolveDbPath(): string {
  let userDataDir = process.env.NARADA_USER_DATA_DIR;

  if (!userDataDir) {
    // Fallback for standalone dev mode (npm run mcp:dev)
    const APP_NAME = "Narad Muni";
    if (process.platform === "darwin") {
      userDataDir = path.join(os.homedir(), "Library", "Application Support", APP_NAME);
    } else if (process.platform === "win32") {
      userDataDir = path.join(
        process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
        APP_NAME
      );
    } else {
      userDataDir = path.join(
        process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
        APP_NAME
      );
    }
  }

  // Check for custom DB path in narada.config.json
  const configPath = path.join(userDataDir, "narada.config.json");
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config.database && config.database.path) {
        return config.database.path;
      }
    }
  } catch {
    // Fall back to default path
  }

  return path.join(userDataDir, "narada.db");
}

/**
 * Open the SQLite database with WAL mode and a 5-second busy timeout.
 * Throws a clear error if the database file doesn't exist.
 */
export function openDb(): Database.Database {
  const dbPath = resolveDbPath();

  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `Database not found at ${dbPath}. Launch Narad Muni at least once to create it.`
    );
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  return db;
}

interface DraftRow {
  id: string;
  rawTranscript: string;
}

/**
 * Append an entry line to the day's draft. Creates the draft if it doesn't exist.
 * Returns the full draft content after appending.
 */
export function appendToDraft(db: Database.Database, dateStr: string, entryLine: string): string {
  // Prisma stores DateTime as epoch milliseconds in SQLite
  const date = new Date(dateStr + "T00:00:00.000Z").getTime();

  const existing = db
    .prepare(`SELECT id, rawTranscript FROM "Draft" WHERE date = ?`)
    .get(date) as DraftRow | undefined;

  if (existing) {
    const newText = existing.rawTranscript + "\n" + entryLine;
    db.prepare(`UPDATE "Draft" SET rawTranscript = ?, updatedAt = datetime('now') WHERE id = ?`)
      .run(newText, existing.id);
    return newText;
  } else {
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO "Draft" (id, date, rawTranscript, updatedAt) VALUES (?, ?, ?, datetime('now'))`
    ).run(id, date, entryLine);
    return entryLine;
  }
}
