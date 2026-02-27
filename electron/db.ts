import * as fs from "fs";
import * as path from "path";
import Database from "better-sqlite3";

/**
 * Initialize or migrate the SQLite database on every app launch.
 * Runs bundled Prisma migration SQL files directly via better-sqlite3
 * so we don't need the Prisma CLI in the packaged app.
 * Pending migrations are applied automatically — safe for schema updates.
 */
export function initializeDatabase(dbPath: string, appRoot: string): void {
  console.log(`[Narada DB] initializeDatabase called`);
  console.log(`[Narada DB]   dbPath: ${dbPath}`);
  console.log(`[Narada DB]   appRoot: ${appRoot}`);

  const dbExists = fs.existsSync(dbPath);
  console.log(`[Narada DB]   dbExists: ${dbExists}`);

  // Ensure parent directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    console.log(`[Narada DB]   Creating directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);

  try {
    // Enable WAL mode for better concurrent access
    db.pragma("journal_mode = WAL");

    // Create Prisma's migration tracking table
    db.exec(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                    TEXT PRIMARY KEY NOT NULL,
        "checksum"              TEXT NOT NULL,
        "finished_at"           DATETIME,
        "migration_name"        TEXT NOT NULL,
        "logs"                  TEXT,
        "rolled_back_at"        DATETIME,
        "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
        "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Collect already-applied migration names
    const applied = new Set<string>(
      db
        .prepare(`SELECT "migration_name" FROM "_prisma_migrations"`)
        .all()
        .map((row) => (row as Record<string, unknown>).migration_name as string)
    );
    console.log(`[Narada DB]   Already applied migrations: ${[...applied].join(", ") || "(none)"}`);

    // Find all migration SQL files in order
    const migrationsDir = path.join(appRoot, "prisma", "migrations");
    console.log(`[Narada DB]   Migrations dir: ${migrationsDir}`);
    if (!fs.existsSync(migrationsDir)) {
      console.error(`[Narada DB]   ERROR: Migrations directory not found: ${migrationsDir}`);
      throw new Error(`Migrations directory not found: ${migrationsDir}`);
    }

    const migrationDirs = fs
      .readdirSync(migrationsDir)
      .filter((name) => {
        const fullPath = path.join(migrationsDir, name);
        return (
          fs.statSync(fullPath).isDirectory() &&
          fs.existsSync(path.join(fullPath, "migration.sql"))
        );
      })
      .sort(); // Timestamp-prefixed names sort correctly

    console.log(`[Narada DB]   Found ${migrationDirs.length} migration(s): ${migrationDirs.join(", ")}`);

    // Apply only pending migrations
    let migrationsRan = 0;
    for (const migrationName of migrationDirs) {
      if (applied.has(migrationName)) {
        console.log(`[Narada DB]   Skipping (already applied): ${migrationName}`);
        continue;
      }

      const sqlPath = path.join(migrationsDir, migrationName, "migration.sql");
      const sql = fs.readFileSync(sqlPath, "utf-8");

      console.log(`[Narada DB]   Running migration: ${migrationName}`);
      console.log(`[Narada DB]   SQL:\n${sql.trim()}`);
      try {
        db.exec(sql);
        console.log(`[Narada DB]   Migration ${migrationName} executed successfully`);
      } catch (err: unknown) {
        // Handle cases where `prisma db push` already applied the schema change
        // but didn't record it in the migrations table (e.g. "duplicate column name").
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Narada DB]   Migration ${migrationName} SQL error: ${msg}`);
        if (msg.includes("duplicate column name") || msg.includes("already exists")) {
          console.log(`[Narada DB]   Schema already in sync, recording migration.`);
        } else {
          console.error(`[Narada DB]   FATAL: Migration ${migrationName} failed: ${msg}`);
          throw err;
        }
      }

      // Record migration in tracking table
      const id = generateMigrationId();
      db.prepare(
        `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "applied_steps_count")
         VALUES (?, ?, datetime('now'), ?, 1)`
      ).run(id, checksumSql(sql), migrationName);
      console.log(`[Narada DB]   Recorded migration: ${migrationName}`);
      migrationsRan++;
    }

    // Log current schema state for debugging
    try {
      const tableInfo = db.prepare(`PRAGMA table_info("PlatformConfig")`).all() as Array<Record<string, unknown>>;
      console.log(`[Narada DB]   PlatformConfig columns: ${tableInfo.map((col) => col.name).join(", ")}`);
    } catch { /* non-critical */ }

    // Seed default data if PlatformConfig is empty.
    // This handles both fresh DBs and DBs created by `prisma db push` (which
    // creates tables but doesn't seed).
    const configCount = (db.prepare(`SELECT COUNT(*) as cnt FROM "PlatformConfig"`).get() as { cnt: number }).cnt;
    console.log(`[Narada DB]   PlatformConfig row count: ${configCount}`);

    if (configCount === 0) {
      console.log("[Narada DB]   No platform configs found — seeding default data");
      seedDatabase(db);
      console.log("[Narada DB] Database seeded successfully");
    } else if (migrationsRan > 0) {
      console.log(`[Narada DB] Applied ${migrationsRan} pending migration(s)`);
    } else {
      console.log("[Narada DB] Database is up to date");
    }
  } catch (err) {
    console.error("[Narada DB] initializeDatabase FAILED:", err);
    throw err;
  } finally {
    db.close();
  }
}

function seedDatabase(db: Database.Database): void {
  console.log("Seeding default data...");

  db.prepare(
    `INSERT OR IGNORE INTO "PlatformConfig" ("id", "platform", "userName", "userId", "webhookUrl", "slackThreadMode", "isActive")
     VALUES (?, ?, '', '', '', 1, 1)`
  ).run("default-slack", "SLACK");

  db.prepare(
    `INSERT OR IGNORE INTO "PlatformConfig" ("id", "platform", "userName", "userId", "webhookUrl", "isActive")
     VALUES (?, ?, '', '', '', 1)`
  ).run("default-teams", "TEAMS");

  db.prepare(
    `INSERT OR IGNORE INTO "PlatformConfig" ("id", "platform", "baseUrl", "projectKey", "email", "apiToken", "timezone", "isActive")
     VALUES (?, ?, '', '', '', '', 'Asia/Kolkata', 1)`
  ).run("default-jira", "JIRA");

  db.prepare(
    `INSERT OR IGNORE INTO "AppSettings" ("id", "aiProvider")
     VALUES ('app-settings', 'local-claude')`
  ).run();

  console.log("Seed completed");
}

function generateMigrationId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 36; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function checksumSql(sql: string): string {
  // Simple hash for migration tracking — Prisma uses SHA-256 but a basic
  // checksum suffices since we only need to mark migrations as applied.
  let hash = 0;
  for (let i = 0; i < sql.length; i++) {
    const char = sql.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(16);
}
