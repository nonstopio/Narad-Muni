import { app, dialog, BrowserWindow, shell } from "electron";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const APP_TITLE = "Narad Muni";
const DOWNLOAD_PAGE_URL = "https://nonstopio.github.io/Narad-Muni/";
const GITHUB_API_LATEST =
  "https://api.github.com/repos/nonstopio/Narad-Muni/releases/latest";

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}

/** Compare two semver strings (e.g. "1.5.0" vs "1.6.0"). Returns true if remote > local. */
function isNewer(remote: string, local: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [rMaj, rMin, rPatch] = parse(remote);
  const [lMaj, lMin, lPatch] = parse(local);
  if (rMaj !== lMaj) return rMaj > lMaj;
  if (rMin !== lMin) return rMin > lMin;
  return rPatch > lPatch;
}

/** Fetch JSON from a URL (follows one redirect). */
function fetchJSON(url: string): Promise<GitHubRelease> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "Narad-Muni-Updater" } }, (res) => {
      // Follow one redirect
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchJSON(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`GitHub API returned ${res.statusCode}`));
        return;
      }
      let data = "";
      res.on("data", (chunk: string) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(15_000, () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
  });
}

/** Find the DMG asset URL for the current architecture. */
function findDmgUrl(assets: GitHubAsset[], version: string): string | null {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const cleanVersion = version.replace(/^v/, "");
  const expectedName = `Narad-Muni-${cleanVersion}-${arch}.dmg`;
  const asset = assets.find((a) => a.name === expectedName);
  return asset?.browser_download_url ?? null;
}

/** Download a file to ~/Downloads with progress shown in the title bar. */
function downloadDmg(url: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const destPath = path.join(os.homedir(), "Downloads", filename);
    const file = fs.createWriteStream(destPath);
    const win = getMainWindow();

    const doDownload = (downloadUrl: string) => {
      https.get(downloadUrl, { headers: { "User-Agent": "Narad-Muni-Updater" } }, (res) => {
        // Follow redirect (GitHub asset URLs redirect to S3)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doDownload(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          reject(new Error(`Download failed with status ${res.statusCode}`));
          return;
        }

        const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
        let receivedBytes = 0;

        res.on("data", (chunk: Buffer) => {
          receivedBytes += chunk.length;
          if (totalBytes > 0 && win && !win.isDestroyed()) {
            const pct = Math.round((receivedBytes / totalBytes) * 100);
            win.setProgressBar(receivedBytes / totalBytes);
            win.setTitle(`${APP_TITLE} — Downloading ${pct}%`);
          }
        });

        res.pipe(file);

        file.on("finish", () => {
          file.close(() => {
            if (win && !win.isDestroyed()) {
              win.setProgressBar(-1);
              win.setTitle(APP_TITLE);
            }
            resolve(destPath);
          });
        });

        file.on("error", (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      }).on("error", (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };

    doDownload(url);
  });
}

/** Check GitHub Releases for a newer version and prompt the user. */
async function checkForUpdate(manual: boolean): Promise<void> {
  const currentVersion = app.getVersion();

  let release: GitHubRelease;
  try {
    release = await fetchJSON(GITHUB_API_LATEST);
  } catch (err) {
    if (manual) {
      dialog.showMessageBox({
        type: "error",
        title: "Alas!",
        message: "The sage could not reach the celestial repository.",
        detail: String(err),
      });
    }
    console.error("[updater] Failed to check for updates:", err);
    return;
  }

  const remoteVersion = release.tag_name.replace(/^v/, "");

  if (!isNewer(remoteVersion, currentVersion)) {
    if (manual) {
      dialog.showMessageBox({
        type: "info",
        title: "Narayan Narayan!",
        message: "You possess the latest sacred scroll.",
        detail: `Version ${currentVersion} — the sage has nothing newer to offer.`,
      });
    }
    console.log(`[updater] Up to date (v${currentVersion})`);
    return;
  }

  console.log(`[updater] Update available: v${remoteVersion} (current: v${currentVersion})`);

  const dmgUrl = findDmgUrl(release.assets, remoteVersion);

  const buttons = dmgUrl
    ? ["Download & Show in Finder", "Open Download Page", "Later"]
    : ["Open Download Page", "Later"];

  const { response } = await dialog.showMessageBox({
    type: "info",
    title: "Narayan Narayan!",
    message: `A new sacred scroll has arrived — v${remoteVersion}!`,
    detail: `You are on v${currentVersion}. Choose how to receive the update.`,
    buttons,
    defaultId: 0,
    cancelId: buttons.length - 1,
  });

  const chosen = buttons[response];

  if (chosen === "Download & Show in Finder" && dmgUrl) {
    const arch = process.arch === "arm64" ? "arm64" : "x64";
    const filename = `Narad-Muni-${remoteVersion}-${arch}.dmg`;

    try {
      const filePath = await downloadDmg(dmgUrl, filename);
      shell.showItemInFolder(filePath);
    } catch (err) {
      console.error("[updater] Download failed:", err);
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.setProgressBar(-1);
        win.setTitle(APP_TITLE);
      }
      dialog.showMessageBox({
        type: "error",
        title: "Alas!",
        message: "The sacred scroll could not be fetched.",
        detail: `${String(err)}\n\nYou can download it manually from the website.`,
        buttons: ["Open Download Page", "Dismiss"],
        defaultId: 0,
      }).then(({ response: r }) => {
        if (r === 0) shell.openExternal(DOWNLOAD_PAGE_URL);
      });
    }
  } else if (chosen === "Open Download Page") {
    shell.openExternal(DOWNLOAD_PAGE_URL);
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
    checkForUpdate(false).catch((err) => {
      console.error("[updater] Auto-check failed:", err);
    });
  }, 10_000);
}

/**
 * Triggered from "Check for Updates..." menu item.
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

  checkForUpdate(true).catch((err) => {
    console.error("[updater] Manual check failed:", err);
    dialog.showMessageBox({
      type: "error",
      title: "Alas!",
      message: "The sage could not reach the celestial repository.",
      detail: String(err),
    });
  });
}
