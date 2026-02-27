import fs from "fs";
import path from "path";

const MAX_ENTRIES = 1000;

function getLogPath(): string {
  const userDataDir = process.env.NARADA_USER_DATA_DIR;
  if (userDataDir) {
    return path.join(userDataDir, "narada-activity.log");
  }
  return path.join(process.cwd(), "narada-activity.log");
}

const LOG_PATH = getLogPath();

function truncateIfNeeded() {
  try {
    if (!fs.existsSync(LOG_PATH)) return;
    const content = fs.readFileSync(LOG_PATH, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    if (lines.length > MAX_ENTRIES) {
      const trimmed = lines.slice(-MAX_ENTRIES).join("\n") + "\n";
      fs.writeFileSync(LOG_PATH, trimmed);
    }
  } catch {
    // Never crash the app over logging
  }
}

function serialize(a: unknown): string {
  if (typeof a === "string") return a;
  if (a instanceof Error) {
    const extras = Object.keys(a).length > 0 ? ` ${JSON.stringify(a, Object.getOwnPropertyNames(a))}` : "";
    return `${a.name}: ${a.message}${a.stack ? `\n${a.stack}` : ""}${extras}`;
  }
  try {
    const json = JSON.stringify(a);
    // If stringify produced "{}" but the object has own properties, try harder
    if (json === "{}" && a && typeof a === "object" && Object.getOwnPropertyNames(a).length > 0) {
      return JSON.stringify(a, Object.getOwnPropertyNames(a));
    }
    return json;
  } catch {
    return String(a);
  }
}

let _logging = false;

function appendEntry(level: string, args: unknown[]) {
  if (_logging) return; // prevent duplicate lines from re-entrant console calls
  _logging = true;
  try {
    const timestamp = new Date().toISOString();
    const message = args.map(serialize).join(" ");
    fs.appendFileSync(LOG_PATH, `[${timestamp}] [${level}] ${message}\n`);
  } catch {
    // Never crash the app over logging
  } finally {
    _logging = false;
  }
}

// Monkey-patch console methods
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args: unknown[]) => {
  originalLog(...args);
  appendEntry("INFO", args);
};

console.warn = (...args: unknown[]) => {
  originalWarn(...args);
  appendEntry("WARN", args);
};

console.error = (...args: unknown[]) => {
  originalError(...args);
  appendEntry("ERROR", args);
};

// Truncate on first load
truncateIfNeeded();

export function getLogContents(maxEntries = 100): string {
  try {
    if (!fs.existsSync(LOG_PATH)) return "";
    const content = fs.readFileSync(LOG_PATH, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    return lines.slice(-maxEntries).join("\n");
  } catch {
    return "";
  }
}
