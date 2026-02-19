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
  const dbExists = fs.existsSync(dbPath);

  // Ensure parent directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
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

    // Find all migration SQL files in order
    const migrationsDir = path.join(appRoot, "prisma", "migrations");
    if (!fs.existsSync(migrationsDir)) {
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

    // Apply only pending migrations
    let migrationsRan = 0;
    for (const migrationName of migrationDirs) {
      if (applied.has(migrationName)) continue;

      const sqlPath = path.join(migrationsDir, migrationName, "migration.sql");
      const sql = fs.readFileSync(sqlPath, "utf-8");

      console.log(`Running migration: ${migrationName}`);
      db.exec(sql);

      // Record migration in tracking table
      const id = generateMigrationId();
      db.prepare(
        `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "applied_steps_count")
         VALUES (?, ?, datetime('now'), ?, 1)`
      ).run(id, checksumSql(sql), migrationName);
      migrationsRan++;
    }

    // Seed default data on first launch
    if (!dbExists) {
      seedDatabase(db);
      console.log("Database initialized successfully");
    } else if (migrationsRan > 0) {
      console.log(`Applied ${migrationsRan} pending migration(s)`);
    } else {
      console.log("Database is up to date");
    }
  } finally {
    db.close();
  }
}

function seedDatabase(db: Database.Database): void {
  console.log("Seeding default data...");

  const upsertConfig = db.prepare(`
    INSERT OR IGNORE INTO "PlatformConfig" ("id", "platform", "userName", "userId", "webhookUrl", "isActive")
    VALUES (?, ?, '', '', '', 1)
  `);

  upsertConfig.run("default-slack", "SLACK");
  upsertConfig.run("default-teams", "TEAMS");

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
