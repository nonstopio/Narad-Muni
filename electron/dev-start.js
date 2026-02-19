const { execSync } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

const appName = "narada-app";

let userDataDir;
if (process.platform === "darwin") {
  userDataDir = path.join(os.homedir(), "Library", "Application Support", appName);
} else if (process.platform === "win32") {
  userDataDir = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), appName);
} else {
  userDataDir = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), appName);
}

process.env.NARADA_USER_DATA_DIR = userDataDir;

// Read the config to get the DB path (mirrors electron/config.ts getDbPath logic)
const configPath = path.join(userDataDir, "narada.config.json");
let dbPath = path.join(userDataDir, "narada.db");
try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (config.database && config.database.path) {
      dbPath = config.database.path;
    }
  }
} catch {
  // Fall back to default path
}

// Override DATABASE_URL so the Next.js dev server uses the same DB as Electron
process.env.DATABASE_URL = `file:${dbPath}`;

console.log(`[dev-start] userDataDir: ${userDataDir}`);
console.log(`[dev-start] DATABASE_URL: ${process.env.DATABASE_URL}`);

// Apply any pending schema changes to the Electron DB before Next.js starts
console.log("[dev-start] Syncing database schema...");
execSync("npx prisma db push --skip-generate", { stdio: "inherit", env: process.env });

execSync(
  'concurrently --kill-others "npm run dev" "wait-on http://localhost:3947 && electron ."',
  { stdio: "inherit", env: process.env }
);
