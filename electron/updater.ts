import { app, dialog, BrowserWindow } from "electron";
import { autoUpdater, UpdateInfo } from "electron-updater";

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
let isDownloading = false;
let isManualCheck = false;

function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
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
    const win = getMainWindow();
    if (win) {
      win.setProgressBar(progress.percent / 100);
      const pct = Math.round(progress.percent);
      win.setTitle(`${APP_TITLE} — Downloading ${pct}%`);
    }
  });

  autoUpdater.on("update-downloaded", () => {
    isDownloading = false;
    const win = getMainWindow();
    if (win) {
      win.setProgressBar(-1);
      win.setTitle(APP_TITLE);
    }

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
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater] Error:", err);

    const wasDownloading = isDownloading;

    // Clean up progress state
    if (isDownloading) {
      isDownloading = false;
      const win = getMainWindow();
      if (win) {
        win.setProgressBar(-1);
        win.setTitle(APP_TITLE);
      }
    }

    // Only show dialog for download errors.
    // Check errors are handled by their respective .catch() handlers
    // (manual check shows its own dialog; auto-check stays silent).
    if (wasDownloading) {
      dialog.showMessageBox({
        type: "error",
        title: "Alas!",
        message: "The sage encountered a disturbance while fetching the scroll.",
        detail: String(err),
      });
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
