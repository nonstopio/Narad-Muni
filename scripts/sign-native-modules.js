/**
 * macOS Code Signing for Native Modules
 *
 * On macOS 26+, Code Signing Monitor (CSM) requires all dynamically loaded
 * native modules (.node files) to have a proper ad-hoc code signature —
 * not just the linker-applied signature. Without this, Electron crashes with
 * SIGKILL (Code Signature Invalid) when loading native modules via dlopen().
 *
 * This script:
 * 1. Finds all .node files in node_modules/
 * 2. Re-signs them with `codesign --force --sign -`
 * 3. Re-signs the Electron.app bundle
 */

const { execSync } = require("child_process");
const path = require("path");

if (process.platform !== "darwin") {
  console.log("[sign-native-modules] Skipping — not macOS");
  process.exit(0);
}

const root = path.resolve(__dirname, "..");
const electronApp = path.join(root, "node_modules/electron/dist/Electron.app");

// Find and sign all .node files
try {
  const result = execSync(
    `find "${path.join(root, "node_modules")}" -name "*.node" -type f`,
    { encoding: "utf-8" }
  ).trim();

  if (result) {
    const files = result.split("\n");
    console.log(`[sign-native-modules] Signing ${files.length} native module(s)...`);
    for (const file of files) {
      execSync(`codesign --force --sign - "${file}"`, { stdio: "pipe" });
    }
  }
} catch (err) {
  console.warn("[sign-native-modules] Warning: failed to sign .node files:", err.message);
}

// Re-sign Electron.app
try {
  console.log("[sign-native-modules] Re-signing Electron.app...");
  execSync(`codesign --force --deep --sign - "${electronApp}"`, { stdio: "inherit" });
  console.log("[sign-native-modules] Done.");
} catch (err) {
  console.warn("[sign-native-modules] Warning: failed to sign Electron.app:", err.message);
}
