// Local git projects for "Fetch from Projects". Everything here is read-only
// git plus one JSON file in userData. No Electron imports, so the test can
// drive it directly; main.ts wires the dialog and the signed-in uid.

import { execFile } from "child_process";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

// Twins of the types in src/types/index.ts (the Electron tsconfig cannot import src/).
export interface LocalProject {
  id: string;
  name: string;
  root: string;
  commonDir: string;
  enabled: boolean;
  authorEmails: string[];
}

type GitFailure = "git-missing" | "missing-folder" | "unreadable" | "timed-out" | "too-large";
type GitResult = { ok: true; stdout: string } | { ok: false; reason: GitFailure };

const EMAIL = /^[^\s@]+@[^\s@]+$/;

/** Read-only git: argument arrays, no shell, no hooks, no fsmonitor, no optional index writes. */
export function runGit(cwd: string, args: string[]): Promise<GitResult> {
  if (!fs.existsSync(cwd)) return Promise.resolve({ ok: false, reason: "missing-folder" });
  return new Promise((resolve) => {
    execFile(
      "git",
      ["-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", ...args],
      {
        cwd,
        timeout: 15_000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C", GIT_PAGER: "cat" },
      },
      (err, stdout) => {
        if (!err) return resolve({ ok: true, stdout });
        const e = err as NodeJS.ErrnoException & { killed?: boolean; code?: string | number };
        if (e.code === "ENOENT") return resolve({ ok: false, reason: "git-missing" });
        if (e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") return resolve({ ok: false, reason: "too-large" });
        if (e.killed) return resolve({ ok: false, reason: "timed-out" });
        resolve({ ok: false, reason: "unreadable" });
      }
    );
  });
}

/** Resolve a chosen folder to its repository. Runs rev-parse and config --get only. */
export async function resolveRepo(
  folder: string
): Promise<{ root: string; commonDir: string; email: string | null } | { error: "not-a-repo" | "git-missing" }> {
  const rev = await runGit(folder, ["rev-parse", "--show-toplevel", "--git-common-dir"]);
  if (!rev.ok) return { error: rev.reason === "git-missing" ? "git-missing" : "not-a-repo" };
  const [toplevel, commonOut] = rev.stdout.split("\n");
  if (!toplevel || !commonOut) return { error: "not-a-repo" };
  const root = fs.realpathSync(toplevel);
  // A relative --git-common-dir is relative to the cwd git ran in.
  const commonDir = fs.realpathSync(path.resolve(folder, commonOut));
  const cfg = await runGit(root, ["config", "--get", "user.email"]);
  const email = cfg.ok ? cfg.stdout.trim().toLowerCase() : "";
  return { root, commonDir, email: EMAIL.test(email) ? email : null };
}

function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

interface UserProjects {
  workdayTimeZone: string | null;
  projects: LocalProject[];
}

interface StoreFile {
  version: 1;
  users: Record<string, UserProjects>;
}

export function createProjectStore({ filePath, getUid }: { filePath: string; getUid: () => string | undefined }) {
  function readFile(): StoreFile {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (parsed && typeof parsed.users === "object") return parsed;
    } catch {
      // Missing or unreadable: start empty.
    }
    return { version: 1, users: {} };
  }

  /** The signed-in user's slice. The uid always comes from config, never from the renderer. */
  function load(): { uid: string; file: StoreFile; mine: UserProjects } | null {
    const uid = getUid();
    if (!uid) return null;
    const file = readFile();
    const mine = file.users[uid] ?? { workdayTimeZone: null, projects: [] };
    return { uid, file, mine };
  }

  function save(uid: string, file: StoreFile, mine: UserProjects) {
    file.users[uid] = mine;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(file, null, 2), "utf-8");
  }

  function find(mine: UserProjects, id: unknown): LocalProject {
    const p = typeof id === "string" ? mine.projects.find((x) => x.id === id) : undefined;
    if (!p) throw new Error("Unknown project");
    return p;
  }

  return {
    list() {
      const s = load();
      if (!s) return { error: "signed-out" as const };
      return { workdayTimeZone: s.mine.workdayTimeZone, projects: s.mine.projects };
    },

    /** `folder` comes from the main-process folder dialog, never from the renderer. */
    async add(folder: string) {
      const s = load();
      if (!s) return { error: "signed-out" as const };
      const repo = await resolveRepo(folder);
      if ("error" in repo) return { error: repo.error };
      // Same common dir = same repository (a subfolder, or a linked worktree sharing its history).
      const dup = s.mine.projects.find((p) => p.commonDir === repo.commonDir);
      if (dup) return { error: "duplicate" as const, name: dup.name };
      const project: LocalProject = {
        id: randomUUID(),
        name: path.basename(repo.root),
        root: repo.root,
        commonDir: repo.commonDir,
        enabled: true,
        authorEmails: repo.email ? [repo.email] : [],
      };
      s.mine.projects.push(project);
      save(s.uid, s.file, s.mine);
      return { project };
    },

    update(patch: { id: unknown; name?: unknown; enabled?: unknown; authorEmails?: unknown }) {
      const s = load();
      if (!s) return { error: "signed-out" as const };
      const p = find(s.mine, patch?.id);
      if (patch.name !== undefined) {
        const name = typeof patch.name === "string" ? patch.name.trim() : "";
        if (name.length < 1 || name.length > 60) throw new Error("Invalid name");
        p.name = name;
      }
      if (patch.enabled !== undefined) {
        if (typeof patch.enabled !== "boolean") throw new Error("Invalid enabled");
        p.enabled = patch.enabled;
      }
      if (patch.authorEmails !== undefined) {
        const list = patch.authorEmails;
        if (!Array.isArray(list) || list.length > 10 || !list.every((e) => typeof e === "string" && EMAIL.test(e.trim()))) {
          throw new Error("Invalid emails");
        }
        p.authorEmails = [...new Set(list.map((e: string) => e.trim().toLowerCase()))];
      }
      save(s.uid, s.file, s.mine);
      return { project: p };
    },

    remove(id: unknown) {
      const s = load();
      if (!s) return { error: "signed-out" as const };
      s.mine.projects = s.mine.projects.filter((p) => p.id !== id);
      save(s.uid, s.file, s.mine);
      return { ok: true as const };
    },

    setTimeZone(tz: unknown) {
      const s = load();
      if (!s) return { error: "signed-out" as const };
      if (tz !== null && !isTimeZone(tz)) throw new Error("Invalid timezone");
      s.mine.workdayTimeZone = tz;
      save(s.uid, s.file, s.mine);
      return { workdayTimeZone: s.mine.workdayTimeZone };
    },

  };
}
