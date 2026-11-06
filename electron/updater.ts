import type { MessageBoxOptions } from "electron";

// Electron and electron-updater are required lazily inside initAutoUpdater /
// checkForUpdatesManual, so the controller can be tested under plain node.

const STARTUP_DELAY_MS = 10_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const RETRY_DELAY_MS = 30 * 60 * 1000;

type State = "idle" | "checking" | "downloading" | "downloaded";
type Timer = { unref?: () => void } | number | undefined;

/** The slice of electron-updater's AppUpdater we use. */
export interface Updater {
  on(event: string, listener: (...args: any[]) => void): unknown;
  checkForUpdates(): Promise<{ downloadPromise?: Promise<unknown> | null } | null>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

export interface UpdateControllerDeps {
  updater?: Updater; // omitted for unsupported builds
  isSupported: boolean;
  showMessageBox: (opts: MessageBoxOptions) => Promise<{ response: number }>;
  getVersion: () => string;
  log: { info: (...a: unknown[]) => void; error: (...a: unknown[]) => void };
  onBeforeRestart: () => void;
  onRestartAborted: () => void;
  onReady: (version: string | null) => void; // light (version) or clear (null) the sidebar update tile
  setTimeout: (fn: () => void, ms: number) => Timer;
  setInterval: (fn: () => void, ms: number) => Timer;
  clearTimeout: (t: any) => void;
}

const ALAS = "Alas!";
const NARAYAN = "Narayan Narayan!";

export function createUpdateController(deps: UpdateControllerDeps) {
  const { updater, showMessageBox, log } = deps;

  if (!deps.isSupported || !updater) {
    return {
      getState: (): State => "idle",
      getReadyVersion: (): string | null => null,
      install: () => {},
      start: () => log.info("Auto-updates not supported in this build — skipping"),
      checkManual: () => {
        showMessageBox({
          type: "info",
          title: NARAYAN,
          message: "The sage does not deliver updates to this build.",
          detail: "Dev and store builds receive their scrolls through their own realm.",
        });
      },
    };
  }

  let state: State = "idle";
  let manual = false; // a user-initiated check/download is awaiting its outcome
  let restartRequested = false;
  let percent: number | null = null;
  let downloadedVersion: string | null = null;
  let retryTimer: Timer = undefined;

  function check(isManual: boolean): void {
    if (state !== "idle") return;
    if (retryTimer !== undefined) {
      deps.clearTimeout(retryTimer);
      retryTimer = undefined;
    }
    state = "checking";
    manual = isManual;
    percent = null;
    log.info(`Checking for updates (${isManual ? "manual" : "background"})`);
    updater!
      .checkForUpdates()
      .then((result) => {
        // Download failures arrive via the 'error' event; silence the duplicate rejection.
        result?.downloadPromise?.catch(() => {});
        if (!result && state === "checking") {
          state = "idle";
          manual = false;
        }
      })
      .catch(fail);
  }

  /**
   * Single sink for failures. checkForUpdates() both emits 'error' and rejects,
   * so once state is back to idle a repeat report is only logged.
   */
  function fail(err: unknown): void {
    log.error("Update failed:", err);
    if (state === "idle" && !restartRequested) return;

    const showDialog = manual || restartRequested;
    const wasReady = state === "downloaded";
    if (restartRequested) deps.onRestartAborted();
    state = "idle";
    if (wasReady) deps.onReady(null); // stop the tile's spinner / hide a tile that can no longer install
    manual = false;
    restartRequested = false;

    if (showDialog) {
      showMessageBox({
        type: "error",
        title: ALAS,
        message: "The sage could not bring the new scroll from the celestial repository.",
        detail: String(err),
      });
    } else if (retryTimer === undefined) {
      retryTimer = deps.setTimeout(() => {
        retryTimer = undefined;
        check(false);
      }, RETRY_DELAY_MS);
    }
  }

  function install(): void {
    if (state !== "downloaded" || restartRequested) return;
    restartRequested = true;
    deps.onBeforeRestart();
    updater!.quitAndInstall(false, true);
  }

  updater.on("update-available", (info: { version: string }) => {
    log.info(`Update available: v${info.version}`);
    state = "downloading";
    // Keep `manual` set so a failed download is still reported to the user who asked.
    if (manual) {
      showMessageBox({
        type: "info",
        title: NARAYAN,
        message: `A new scroll, v${info.version}, is on its way!`,
        detail: "I am fetching it in the background and shall light a lamp in the sidebar once it is ready.",
      });
    }
  });

  updater.on("update-not-available", () => {
    log.info(`Up to date (v${deps.getVersion()})`);
    state = "idle";
    if (manual) {
      manual = false;
      showMessageBox({
        type: "info",
        title: NARAYAN,
        message: "You possess the latest sacred scroll.",
        detail: `Version ${deps.getVersion()} — the sage has nothing newer to offer.`,
      });
    }
  });

  updater.on("download-progress", (p: { percent: number }) => {
    percent = p.percent;
  });

  updater.on("update-downloaded", (info: { version: string }) => {
    log.info(`Update downloaded: v${info.version}`);
    state = "downloaded";
    manual = false;
    downloadedVersion = info.version;
    // No dialog: an unparented box can land on another screen. The sidebar tile installs on click.
    deps.onReady(info.version);
  });

  updater.on("error", fail);

  return {
    getState: () => state,
    getReadyVersion: () => (state === "downloaded" ? downloadedVersion : null),
    install,
    start: () => {
      deps.setTimeout(() => check(false), STARTUP_DELAY_MS);
      const interval = deps.setInterval(() => check(false), CHECK_INTERVAL_MS);
      if (typeof interval === "object") interval.unref?.();
    },
    checkManual: () => {
      if (state === "downloaded") {
        // The sidebar tile is the one place to install from (or Quit installs it).
        showMessageBox({
          type: "info",
          title: NARAYAN,
          message: `A new sacred scroll, v${downloadedVersion}, awaits you!`,
          detail: "Click the glowing icon in the sidebar to install it now, or I shall install it when you quit.",
        });
      } else if (state === "idle") {
        check(true);
      } else {
        const progress = percent !== null ? ` (${Math.round(percent)}% gathered)` : "";
        showMessageBox({
          type: "info",
          title: NARAYAN,
          message: `The sage is already seeking a new scroll${progress}.`,
          detail: "I shall light a lamp in the sidebar once it is ready.",
        });
      }
    },
  };
}

type RestartHooks = {
  onBeforeRestart?: () => void;
  onRestartAborted?: () => void;
  onReady?: (version: string | null) => void;
};

let controller: ReturnType<typeof createUpdateController> | null = null;
let hooks: RestartHooks = {}; // read at call time, so a menu click before init is safe

function getController() {
  if (controller) return controller;
  const { app, dialog, BrowserWindow } = require("electron") as typeof import("electron");
  const isSupported =
    app.isPackaged && !process.mas && (process.platform === "darwin" || process.platform === "win32");

  const log = {
    info: (...a: unknown[]) => console.log("[updater]", ...a),
    warn: (...a: unknown[]) => console.warn("[updater]", ...a),
    error: (...a: unknown[]) => console.error("[updater]", ...a),
    debug: () => {},
  };

  let updater: Updater | undefined;
  if (isSupported) {
    const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true; // a downloaded update also installs on a normal Quit
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;
    updater = autoUpdater;
  }

  controller = createUpdateController({
    updater,
    isSupported,
    // Parent to the focused window so the box opens on the screen the user is looking at.
    showMessageBox: (o) => {
      const win = BrowserWindow.getFocusedWindow();
      return win ? dialog.showMessageBox(win, o) : dialog.showMessageBox(o);
    },
    getVersion: () => app.getVersion(),
    log,
    onBeforeRestart: () => hooks.onBeforeRestart?.(),
    onRestartAborted: () => hooks.onRestartAborted?.(),
    onReady: (v) => hooks.onReady?.(v),
    setTimeout,
    setInterval,
    clearTimeout,
  });
  return controller;
}

/** Called on app startup: first check after 10s, then every 6 hours. */
export function initAutoUpdater(opts: RestartHooks = {}): void {
  hooks = opts;
  getController().start();
}

/** Triggered from "Check for Updates..." menu item. */
export function checkForUpdatesManual(): void {
  getController().checkManual();
}

/** Version downloaded and waiting to install, or null. */
export function getReadyUpdateVersion(): string | null {
  return getController().getReadyVersion();
}

/** Sidebar "update ready" tile: restart and install the downloaded update. */
export function installUpdate(): void {
  getController().install();
}
