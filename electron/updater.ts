import { app, dialog, shell } from "electron";
import * as https from "https";

const DOWNLOAD_PAGE_URL = "https://nonstopio.github.io/Narad-Muni/";
const GITHUB_API_LATEST =
  "https://api.github.com/repos/nonstopio/Narad-Muni/releases/latest";

interface GitHubRelease {
  tag_name: string;
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

  const { response } = await dialog.showMessageBox({
    type: "info",
    title: "Narayan Narayan!",
    message: `A new sacred scroll has arrived — v${remoteVersion}!`,
    detail: `You are on v${currentVersion}. Choose how to receive the update.`,
    buttons: ["Open Download Page", "Later"],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
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
