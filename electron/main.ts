import { app, BrowserWindow, shell, ipcMain, dialog, Menu, powerSaveBlocker } from "electron";
import * as path from "path";
import { readConfig, getDbPath, saveWindowBounds } from "./config";
import { initializeDatabase } from "./db";
import { findAvailablePort } from "./port";
import { initAutoUpdater, checkForUpdatesManual } from "./updater";
import { setupTray } from "./tray";
import { setupScheduler, reloadSchedule, fireTestNotification, NotificationSettings } from "./scheduler";

// Next.js Turbopack generates hashed Prisma client modules (e.g. @prisma/client-<hash>)
// as symlinks in .next/node_modules/. Inside the asar archive these symlinks break because
// electron-builder strips nested node_modules. Redirect hashed requires to @prisma/client
// which electron-builder does package.
const Module = require("module");
const _resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options: unknown
) {
  if (request.startsWith("@prisma/client-")) {
    return _resolveFilename.call(this, "@prisma/client", parent, isMain, options);
  }
  return _resolveFilename.call(this, request, parent, isMain, options);
};

const APP_NAME = "Narad Muni";
app.setName(APP_NAME);
app.setAboutPanelOptions({
  applicationName: APP_NAME,
  applicationVersion: require("../package.json").version,
  copyright: "Narayan Narayan! I carry your word across all three worlds.",
  iconPath: path.join(__dirname, "..", "resources", "icon.png"),
});
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let appPort = 3947; // default dev port; overridden in production
let appDbPath = "";

// Enforce single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function getAppRoot(): string {
  if (isDev) {
    return path.resolve(__dirname, "..");
  }
  // In packaged app, resources are in app.asar or unpacked alongside it
  return path.join(process.resourcesPath, "app");
}

async function createWindow(port: number): Promise<void> {
  const config = readConfig();

  mainWindow = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    x: config.window.x,
    y: config.window.y,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 20, y: 18 },
    backgroundColor: "#0A0A0F",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Custom application menu so macOS menu bar shows "Narad Muni" instead of "Electron"
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: APP_NAME,
      submenu: [
        { role: "about", label: `About ${APP_NAME}` },
        {
          label: "Check for Updates...",
          click: () => checkForUpdatesManual(),
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide", label: `Hide ${APP_NAME}` },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        {
          label: `Quit ${APP_NAME}`,
          accelerator: "CmdOrCtrl+Q",
          click: () => {
            // Hide to tray instead of quitting so notifications keep firing
            mainWindow?.hide();
          },
        },
      ],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  if (config.window.isMaximized) {
    mainWindow.maximize();
  }

  // Show window when ready to prevent flash
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Save window bounds on close — hide to tray instead of quitting (all platforms)
  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
      return;
    }

    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      saveWindowBounds({
        ...bounds,
        isMaximized: mainWindow.isMaximized(),
      });
    }
  });

  // Save window bounds when hiding to tray
  mainWindow.on("hide", () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      saveWindowBounds({
        ...bounds,
        isMaximized: mainWindow.isMaximized(),
      });
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(`http://localhost:${port}`);
}

async function startApp(): Promise<void> {
  // Fix PATH on macOS when launched from Dock/Finder (ESM-only package).
  // Use Function-based import to prevent TypeScript from converting to require().
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)");
    const fixPath = await dynamicImport("fix-path");
    (fixPath.default || fixPath)();
  } catch {
    console.warn("fix-path not available, PATH may be incomplete");
  }

  // Resolve database path and initialize if needed
  const dbPath = getDbPath();
  appDbPath = dbPath;
  const appRoot = getAppRoot();

  console.log(`App root: ${appRoot}`);
  console.log(`Database path: ${dbPath}`);

  // Set env vars before any Prisma usage
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.NARADA_USER_DATA_DIR = app.getPath("userData");

  // Initialize DB on first launch
  initializeDatabase(dbPath, appRoot);

  if (isDev) {
    // In dev, connect to the already-running Next.js dev server on port 3947
    appPort = 3947;
    console.log(`Dev mode: connecting to Next.js on port ${appPort}`);
    await createWindow(appPort);
  } else {
    // Find available port for production server
    const port = await findAvailablePort();
    appPort = port;
    console.log(`Using port: ${port}`);

    // The standalone Next.js build lives inside the asar at .next/standalone/
    const standaloneDir = path.join(__dirname, "..", ".next", "standalone");
    console.log(`Standalone dir: ${standaloneDir}`);

    const next = require("next");
    const nextApp = next({
      dev: false,
      dir: standaloneDir,
      port,
      hostname: "localhost",
    });
    const handle = nextApp.getRequestHandler();

    await nextApp.prepare();

    const http = require("http");
    const server = http.createServer(handle);
    await new Promise<void>((resolve) => {
      server.listen(port, "localhost", () => {
        console.log(`Next.js server running on http://localhost:${port}`);
        resolve();
      });
    });

    await createWindow(port);
  }

  initAutoUpdater();

  // Prevent macOS App Nap from throttling timers when window is hidden.
  // Without this, scheduled notifications may never fire in the background.
  const blockerId = powerSaveBlocker.start("prevent-app-suspension");
  console.log(`[Main] Power save blocker started (id: ${blockerId})`);

  // System tray — keeps app alive when window is hidden
  try {
    setupTray(() => mainWindow);
  } catch (err) {
    console.error("[Main] Failed to setup system tray:", err);
  }

  // Notification scheduler — fires native reminders on configured schedule
  const getMainWindow = () => mainWindow;
  try {
    setupScheduler(appDbPath, getMainWindow, appPort);
  } catch (err) {
    console.error("[Main] Failed to setup notification scheduler:", err);
  }

  // IPC: renderer passes config directly to avoid cross-process SQLite WAL issues
  ipcMain.handle("reload-notification-schedule", (_event, config: NotificationSettings) => {
    console.log("[Main] IPC: reload-notification-schedule received, config:", JSON.stringify(config));
    try {
      reloadSchedule(config, getMainWindow, appPort);
    } catch (err) {
      console.error("[Main] Failed to reload notification schedule:", err);
    }
  });

  // IPC: renderer asks to fire a test notification
  ipcMain.handle("test-notification", () => {
    try {
      fireTestNotification(getMainWindow, appPort);
    } catch (err) {
      console.error("[Main] Failed to fire test notification:", err);
    }
  });
}

// macOS lifecycle
app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  // Don't quit — app stays alive in system tray for notifications
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

// IPC: native file picker for database path
ipcMain.handle("pick-file-path", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Choose database location",
    defaultPath: "narada.db",
    filters: [{ name: "SQLite Database", extensions: ["db"] }],
    properties: ["createDirectory", "showOverwriteConfirmation"],
  });
  return result.canceled ? null : result.filePath;
});

// Start the app
app.whenReady().then(startApp).catch((err) => {
  console.error("Failed to start app:", err);
  app.quit();
});
