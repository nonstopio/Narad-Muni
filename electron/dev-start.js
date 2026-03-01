const { execSync } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

const appName = "Narad Muni";

let userDataDir;
if (process.platform === "darwin") {
  userDataDir = path.join(os.homedir(), "Library", "Application Support", appName);
} else if (process.platform === "win32") {
  userDataDir = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), appName);
} else {
  userDataDir = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), appName);
}

process.env.NARADA_USER_DATA_DIR = userDataDir;

// Load Firebase service account for the Next.js API routes (dev mode)
const saPath = path.join(__dirname, "..", "resources", "firebase-sa.json");
if (fs.existsSync(saPath)) {
  const saJson = fs.readFileSync(saPath, "utf-8");
  process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = Buffer.from(saJson).toString("base64");
  console.log("[dev-start] Firebase service account loaded from resources/firebase-sa.json");
  // Also set the path for MCP server (used when Electron spawns --mcp in dev)
  process.env.NARADA_FIREBASE_SA_PATH = saPath;
} else {
  console.warn("[dev-start] WARNING: resources/firebase-sa.json not found — API routes will fail without it");
}

console.log(`[dev-start] userDataDir: ${userDataDir}`);

// Kill stale Electron processes that may hold the single-instance lock
try {
  execSync("pkill -f 'electron \\.' 2>/dev/null || true", { stdio: "ignore" });
} catch { /* ignore */ }

execSync(
  'concurrently --kill-others "npm run dev" "wait-on http://localhost:3947 && electron ."',
  { stdio: "inherit", env: process.env }
);
