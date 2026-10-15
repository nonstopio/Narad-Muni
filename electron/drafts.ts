import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

/** Tiny, atomic per-day snapshots. Synchronous acknowledgement protects the last keystroke on Quit. */
export function createDraftStore(root: string, getUid: () => string | undefined) {
  function directory(expectedUid: string) {
    const uid = getUid();
    if (!uid) throw new Error("signed-out");
    if (!expectedUid || uid !== expectedUid) throw new Error("draft-owner-mismatch");
    return path.join(root, createHash("sha256").update(uid).digest("hex"));
  }
  function file(date: string, expectedUid: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("invalid-date");
    return path.join(directory(expectedUid), `${date}.json`);
  }
  return {
    read(date: string, expectedUid: string): unknown {
      try { return JSON.parse(fs.readFileSync(file(date, expectedUid), "utf8")); }
      catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return null; throw err; }
    },
    write(date: string, value: unknown, expectedUid: string) {
      const target = file(date, expectedUid);
      const json = JSON.stringify(value);
      if (!json || Buffer.byteLength(json) > 2 * 1024 * 1024) throw new Error("draft-too-large");
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      const temporary = `${target}.tmp`;
      const fd = fs.openSync(temporary, "w", 0o600);
      try { fs.writeFileSync(fd, json); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(temporary, target);
      if (process.platform !== "win32") {
        const dir = fs.openSync(path.dirname(target), "r");
        try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
      }
    },
    list(expectedUid: string): string[] {
      try { return fs.readdirSync(directory(expectedUid)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, -5)); }
      catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return []; throw err; }
    },
    remove(date: string, expectedUid: string) {
      const target = file(date, expectedUid);
      try { fs.unlinkSync(target); }
      catch (err) { if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err; }
    },
  };
}
