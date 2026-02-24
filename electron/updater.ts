import { app, dialog, BrowserWindow, shell } from "electron";
import { autoUpdater, UpdateInfo } from "electron-updater";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// Console-based logger to avoid adding electron-log dependency
autoUpdater.logger = {
  info: (...args: unknown[]) => console.log("[updater]", ...args),
  warn: (...args: unknown[]) => console.warn("[updater]", ...args),
  error: (...args: unknown[]) => console.error("[updater]", ...args),
  debug: (...args: unknown[]) => console.log("[updater:debug]", ...args),
};

// Don't auto-download — let the user choose
autoUpdater.autoDownload = false;
// Don't silently install on quit — we prompt explicitly
autoUpdater.autoInstallOnAppQuit = false;

const APP_TITLE = "Narad Muni";
const DOWNLOAD_PAGE_URL = "https://nonstopio.github.io/Narad-Muni/";
let isDownloading = false;
let isInstalling = false;
let isManualCheck = false;
let pendingUpdateVersion: string | null = null;

function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}

/** Send update status to the renderer so it can show/hide the blocking overlay. */
function sendUpdateStatus(status: string, progress?: number): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send("update:status", {
      status,
      progress,
      version: pendingUpdateVersion,
    });
  }
}

/**
 * Called on app startup. Delays 10 seconds then checks GitHub Releases.
 * No-ops in dev mode.
 */
export function initAutoUpdater(): void {
  if (!app.isPackaged) {
    console.log("[updater] Dev mode — skipping auto-update check");
    return;
  }

  setTimeout(() => {
    console.log("[updater] Checking for updates...");
    autoUpdater.checkForUpdates().catch((err) => {
      console.error("[updater] Auto-check failed:", err);
    });
  }, 10_000);

  registerEvents();
}

/**
 * Triggered from "Check for Updates..." menu item.
 * Shows "no updates" dialog if already on latest.
 */
export function checkForUpdatesManual(): void {
  if (!app.isPackaged) {
    dialog.showMessageBox({
      type: "info",
      title: "Narayan Narayan!",
      message: "The sage is running in dev mode — updates flow through the source realm directly.",
    });
    return;
  }

  registerEvents();

  isManualCheck = true;

  autoUpdater
    .checkForUpdates()
    .then((result) => {
      isManualCheck = false;
      if (!result || !result.isUpdateAvailable) {
        showUpToDate();
      }
      // If an update IS available, the "update-available" event handler will fire
    })
    .catch((err) => {
      isManualCheck = false;
      dialog.showMessageBox({
        type: "error",
        title: "Alas!",
        message: "The sage could not reach the celestial repository.",
        detail: String(err),
      });
    });
}

let eventsRegistered = false;

function registerEvents(): void {
  if (eventsRegistered) return;
  eventsRegistered = true;

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    pendingUpdateVersion = info.version;

    dialog
      .showMessageBox({
        type: "info",
        title: "Narayan Narayan!",
        message: `A new sacred scroll has arrived — v${info.version}!`,
        detail: "Shall I fetch it from the celestial repository?",
        buttons: ["Download", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          isDownloading = true;

          // Show immediate feedback while download initializes
          const win = getMainWindow();
          if (win) {
            win.setTitle(`${APP_TITLE} — Fetching the scroll...`);
            win.setProgressBar(0.01); // indeterminate-ish indicator
          }
          sendUpdateStatus("downloading", 0);

          autoUpdater.downloadUpdate().catch((err) => {
            // downloadUpdate() can reject before the error event fires
            console.error("[updater] downloadUpdate() rejected:", err);
          });
        }
      });
  });

  autoUpdater.on("update-not-available", () => {
    // Only show dialog for manual checks — auto-check stays silent.
    // The manual flow calls showUpToDate() via the .then() handler.
  });

  autoUpdater.on("download-progress", (progress) => {
    const pct = Math.round(progress.percent);
    const win = getMainWindow();
    if (win) {
      win.setProgressBar(progress.percent / 100);
      win.setTitle(`${APP_TITLE} — Downloading ${pct}%`);
    }
    sendUpdateStatus("downloading", pct);
  });

  autoUpdater.on("update-downloaded", () => {
    isDownloading = false;
    const win = getMainWindow();
    if (win) {
      win.setProgressBar(-1);
      win.setTitle(APP_TITLE);
    }
    sendUpdateStatus("idle");

    dialog
      .showMessageBox({
        type: "info",
        title: "Narayan Narayan!",
        message: "The new scroll has been inscribed!",
        detail: "The sage must briefly retire to apply the sacred update. Restart now?",
        buttons: ["Restart", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          isInstalling = true;
          sendUpdateStatus("installing");
          setImmediate(() => {
            try {
              autoUpdater.quitAndInstall(false, true);
            } catch (err) {
              isInstalling = false;
              console.error("[updater] quitAndInstall failed:", err);
              sendUpdateStatus("idle");
              showManualUpdateDialog(err);
            }
          });
        }
      });
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater] Error:", err);

    const wasDownloading = isDownloading;
    const wasInstalling = isInstalling;

    // Clean up progress state
    if (isDownloading) {
      isDownloading = false;
      const win = getMainWindow();
      if (win) {
        win.setProgressBar(-1);
        win.setTitle(APP_TITLE);
      }
    }
    isInstalling = false;
    sendUpdateStatus("idle");

    // Show manual update dialog for download or install errors.
    // Check errors are handled by their respective .catch() handlers
    // (manual check shows its own dialog; auto-check stays silent).
    if (wasDownloading || wasInstalling) {
      showManualUpdateDialog(err);
    }
  });
}

function getPendingDownloadPath(): string | null {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const version = pendingUpdateVersion;
  if (!version) return null;

  const cacheDir = path.join(
    os.homedir(),
    "Library",
    "Caches",
    "narada-app-updater",
    "pending"
  );
  const zipName = `Narad-Muni-${version}-${arch}.zip`;
  const fullPath = path.join(cacheDir, zipName);

  if (fs.existsSync(fullPath)) return fullPath;

  // Fallback: check for any zip in the pending directory
  if (fs.existsSync(cacheDir)) {
    const files = fs.readdirSync(cacheDir).filter((f) => f.endsWith(".zip"));
    if (files.length > 0) return path.join(cacheDir, files[0]);
  }

  return null;
}

function showManualUpdateDialog(err: unknown): void {
  const cachedFile = getPendingDownloadPath();
  const buttons = ["Open Download Page"];
  if (cachedFile) buttons.push("Show in Finder");
  buttons.push("Dismiss");

  const dismissIndex = buttons.length - 1;

  dialog
    .showMessageBox({
      type: "warning",
      title: "Alas! The sacred update could not be applied",
      message:
        "The celestial scroll was delivered, but a seal prevents its unfurling.",
      detail:
        "This often happens with unsigned builds. You can download the latest version manually or reveal the cached file.\n\n" +
        String(err),
      buttons,
      defaultId: 0,
      cancelId: dismissIndex,
    })
    .then(({ response }) => {
      if (buttons[response] === "Open Download Page") {
        shell.openExternal(DOWNLOAD_PAGE_URL);
      } else if (buttons[response] === "Show in Finder" && cachedFile) {
        shell.showItemInFolder(cachedFile);
      }
    });
}

function showUpToDate(): void {
  dialog.showMessageBox({
    type: "info",
    title: "Narayan Narayan!",
    message: "You possess the latest sacred scroll.",
    detail: `Version ${app.getVersion()} — the sage has nothing newer to offer.`,
  });
}
