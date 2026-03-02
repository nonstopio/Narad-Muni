// Turbopack (Next.js 16) generates hashed external module names like
// "firebase-admin-a14c8a5423a75469/app" inside .next/server/chunks/.
// These hashed symlinks break inside Electron's asar archive because
// electron-builder strips nested node_modules. This script patches them
// back to the real package name after `next build`.

const fs = require("fs");
const path = require("path");

const HASH_PATTERN = /firebase-admin-[a-f0-9]{16}/g;
const REPLACEMENT = "firebase-admin";
let patchedFiles = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.name.endsWith(".js")) {
      const content = fs.readFileSync(fullPath, "utf8");
      const patched = content.replace(HASH_PATTERN, REPLACEMENT);
      if (content !== patched) {
        fs.writeFileSync(fullPath, patched);
        patchedFiles++;
      }
    }
  }
}

const nextDir = path.resolve(__dirname, "..", ".next");
if (fs.existsSync(nextDir)) {
  walk(nextDir);
  console.log(`[fix-turbopack-hashes] Patched ${patchedFiles} file(s)`);
} else {
  console.warn("[fix-turbopack-hashes] .next directory not found");
}
