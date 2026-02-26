import { app, Tray, Menu, nativeImage, BrowserWindow } from "electron";
import * as path from "path";

let tray: Tray | null = null;

export function setupTray(getMainWindow: () => BrowserWindow | null): void {
  const isDev = !app.isPackaged;
  const iconPath = isDev
    ? path.join(__dirname, "..", "resources", "icon.png")
    : path.join(process.resourcesPath, "icon.png");

  console.log(`[Tray] Loading icon from: ${iconPath}`);

  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    console.error(`[Tray] Icon not found or empty at: ${iconPath}`);
    return;
  }

  // Resize for menu bar — 18x18 is standard for macOS, works fine on Windows too
  icon = icon.resize({ width: 18, height: 18 });

  if (process.platform === "darwin") {
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip("Narad Muni");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Narad Muni",
      click: () => {
        const win = getMainWindow();
        if (win) {
          win.show();
          win.focus();
        } else {
          console.warn("[Tray] No main window to show");
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        console.log("[Tray] Quit requested from tray menu");
        app.exit(0);
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    const win = getMainWindow();
    if (win) {
      win.show();
      win.focus();
    } else {
      console.warn("[Tray] Click: no main window to show");
    }
  });

  console.log("[Tray] System tray initialized");
}
