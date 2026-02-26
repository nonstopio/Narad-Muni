import { Notification, BrowserWindow } from "electron";
import * as schedule from "node-schedule";
import Database from "better-sqlite3";

let currentJob: schedule.Job | null = null;

export interface NotificationSettings {
  notificationsEnabled: boolean;
  notificationHour: number;
  notificationMinute: number;
  notificationDays: string;
}

interface NotificationConfigRow {
  notificationsEnabled: number; // SQLite boolean: 0 | 1
  notificationHour: number;
  notificationMinute: number;
  notificationDays: string;
}

function readNotificationConfig(dbPath: string): NotificationSettings | null {
  let db: Database.Database | null = null;
  try {
    db = new Database(dbPath);
    const row = db
      .prepare(
        `SELECT notificationsEnabled, notificationHour, notificationMinute, notificationDays
         FROM "AppSettings" WHERE id = 'app-settings'`
      )
      .get() as NotificationConfigRow | undefined;
    if (!row) {
      console.warn("[Scheduler] No AppSettings row found in database");
      return null;
    }
    // Convert SQLite integer boolean to JS boolean
    return {
      notificationsEnabled: !!row.notificationsEnabled,
      notificationHour: row.notificationHour,
      notificationMinute: row.notificationMinute,
      notificationDays: row.notificationDays,
    };
  } catch (err) {
    console.error("[Scheduler] Failed to read notification config:", err);
    return null;
  } finally {
    db?.close();
  }
}

function getTodayDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function fireTestNotification(
  getMainWindow: () => BrowserWindow | null,
  port: number
): void {
  console.log("[Scheduler] Test notification requested");
  showNotification(getMainWindow, port);
}

function showNotification(
  getMainWindow: () => BrowserWindow | null,
  port: number
): void {
  if (!Notification.isSupported()) {
    console.error("[Scheduler] Native notifications are not supported on this platform");
    return;
  }

  console.log("[Scheduler] Showing notification");
  const notification = new Notification({
    title: "Narayan Narayan!",
    body: "It is time to chronicle your deeds, dear one. The three worlds await your word.",
  });

  notification.on("click", () => {
    console.log("[Scheduler] Notification clicked, opening update page");
    const win = getMainWindow();
    if (win) {
      win.show();
      win.focus();
      const today = getTodayDate();
      win.webContents.loadURL(`http://localhost:${port}/update?date=${today}`);
    } else {
      console.warn("[Scheduler] Notification clicked but no main window available");
    }
  });

  notification.on("failed", (_, error) => {
    console.error("[Scheduler] Notification failed to show:", error);
  });

  notification.show();
}

export function setupScheduler(
  dbPath: string,
  getMainWindow: () => BrowserWindow | null,
  port: number
): void {
  console.log("[Scheduler] Initializing scheduler (reading config from DB)");
  const config = readNotificationConfig(dbPath);
  applySchedule(config, getMainWindow, port);
}

/**
 * Reload schedule with config passed directly from the renderer via IPC.
 * This avoids cross-process SQLite WAL visibility issues.
 */
export function reloadSchedule(
  config: NotificationSettings,
  getMainWindow: () => BrowserWindow | null,
  port: number
): void {
  console.log("[Scheduler] Reloading schedule from IPC config");
  applySchedule(config, getMainWindow, port);
}

function applySchedule(
  config: NotificationSettings | null,
  getMainWindow: () => BrowserWindow | null,
  port: number
): void {
  // Cancel existing job
  if (currentJob) {
    currentJob.cancel();
    currentJob = null;
    console.log("[Scheduler] Previous schedule cancelled");
  }

  if (!config) {
    console.log("[Scheduler] No notification config, scheduler inactive");
    return;
  }

  console.log("[Scheduler] Config:", JSON.stringify(config));

  if (!config.notificationsEnabled) {
    console.log("[Scheduler] Notifications disabled by user");
    return;
  }

  // Parse days: "1,2,3,4,5" -> [1,2,3,4,5]
  // node-schedule uses 0=Sun..6=Sat (same as our DB format)
  const days = config.notificationDays
    .split(",")
    .map((d) => parseInt(d.trim(), 10))
    .filter((d) => d >= 0 && d <= 6);

  if (days.length === 0) {
    console.warn("[Scheduler] No valid days configured, scheduler inactive");
    return;
  }

  // node-schedule RecurrenceRule
  const rule = new schedule.RecurrenceRule();
  rule.dayOfWeek = days;
  rule.hour = config.notificationHour;
  rule.minute = config.notificationMinute;
  rule.second = 0;

  currentJob = schedule.scheduleJob(rule, () => {
    console.log("[Scheduler] Firing scheduled notification");
    showNotification(getMainWindow, port);
  });

  if (!currentJob) {
    console.error(
      `[Scheduler] Failed to create schedule job for ${String(config.notificationHour).padStart(2, "0")}:${String(config.notificationMinute).padStart(2, "0")} on days [${days.join(",")}]`
    );
    return;
  }

  const nextFire = currentJob.nextInvocation();
  console.log(
    `[Scheduler] Scheduled at ${String(config.notificationHour).padStart(2, "0")}:${String(config.notificationMinute).padStart(2, "0")} on days [${days.join(",")}]`
  );
  console.log(`[Scheduler] Next invocation: ${nextFire ? nextFire.toString() : "none"}`);
}
