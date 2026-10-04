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

export interface ProjectCommit {
  projectId: string;
  projectName: string;
  hash: string;
  shortHash: string;
  subject: string;
  body: string;
  authorEmail: string;
  authorName: string;
  authorEpochMs: number;
}

export type ProjectSkipReason =
  | "missing-folder"
  | "not-a-repo"
  | "unreadable"
  | "timed-out"
  | "too-large"
  | "no-author-email";

export type ProjectCollectResult =
  | {
      ok: true;
      date: string;
      timeZone: string;
      projects: { id: string; name: string; commits: ProjectCommit[]; truncated: boolean }[];
      skipped: { id: string; name: string; reason: ProjectSkipReason }[];
    }
  | { ok: false; error: "signed-out" | "git-missing" | "no-projects" | "none-enabled" | "all-failed" | "busy" };

type GitFailure = "git-missing" | "missing-folder" | "unreadable" | "timed-out" | "too-large";
type GitResult = { ok: true; stdout: string } | { ok: false; reason: GitFailure };

const PER_PROJECT_CAP = 50;
const PER_COLLECT_CAP = 150;
const EMAIL = /^[^\s@]+@[^\s@]+$/;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

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

/** Strip C0/C1 control characters except newline, then cap the length. */
export function sanitize(s: string, max: number): string {
  const clean = s.replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, "").trim();
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
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

function isDateKey(s: unknown): s is string {
  return typeof s === "string" && DATE_KEY.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
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
  let busy = false;

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

    async collect(args: { date: unknown; timeZone: unknown }): Promise<ProjectCollectResult> {
      const { date, timeZone } = args ?? {};
      if (!isDateKey(date) || !isTimeZone(timeZone)) throw new Error("Invalid collect arguments");
      const s = load();
      if (!s) return { ok: false, error: "signed-out" };
      if (s.mine.projects.length === 0) return { ok: false, error: "no-projects" };
      const enabled = s.mine.projects.filter((p) => p.enabled);
      if (enabled.length === 0) return { ok: false, error: "none-enabled" };
      if (busy) return { ok: false, error: "busy" };
      busy = true;
      try {
        return await collectFor(enabled, date, timeZone);
      } finally {
        busy = false;
      }
    },
  };
}

async function collectFor(projects: LocalProject[], date: string, timeZone: string): Promise<ProjectCollectResult> {
  // A commit belongs to `date` iff its author time, read in `timeZone`, falls on that
  // calendar day. No offset arithmetic, so 23h/25h DST days come out right.
  const dayOf = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });

  const firstPass = await Promise.all(
    projects.map(async (p) => {
      if (p.authorEmails.length === 0) return { p, reason: "no-author-email" as const };
      // No --since/--until: those filter by committer date. Filter on author time (%at) below instead.
      // ponytail: full-history walk per fetch (~1s per 100k commits), bounded by the 15s timeout;
      // add a --since=<date-90d> guard with a full-walk fallback if a monorepo times out.
      const res = await runGit(p.root, [
        "log", "--branches", "--remotes", "HEAD", "--no-merges", "-F", "-i",
        ...p.authorEmails.map((e) => `--author=${e}`),
        "--format=%H%x1f%ae%x1f%at", "-z",
      ]);
      if (!res.ok) return { p, reason: res.reason };
      const seen = new Set<string>();
      const hits: { hash: string; at: number }[] = [];
      for (const rec of res.stdout.split("\0")) {
        const [hash, ae, at] = rec.trim().split("\x1f");
        if (!hash || seen.has(hash)) continue;
        seen.add(hash);
        if (!p.authorEmails.includes((ae ?? "").toLowerCase())) continue;
        if (dayOf.format(Number(at) * 1000) !== date) continue;
        hits.push({ hash, at: Number(at) });
      }
      hits.sort((a, b) => b.at - a.at);
      return { p, hits };
    })
  );

  if (firstPass.some((r) => "reason" in r && r.reason === "git-missing")) return { ok: false, error: "git-missing" };

  const skipped: { id: string; name: string; reason: ProjectSkipReason }[] = [];
  const read: { p: LocalProject; hits: { hash: string; at: number }[]; truncated: boolean }[] = [];
  for (const r of firstPass) {
    if ("reason" in r) skipped.push({ id: r.p.id, name: r.p.name, reason: r.reason as ProjectSkipReason });
    else read.push({ p: r.p, hits: r.hits.slice(0, PER_PROJECT_CAP), truncated: r.hits.length > PER_PROJECT_CAP });
  }
  if (read.length === 0 && skipped.every((x) => x.reason !== "no-author-email")) return { ok: false, error: "all-failed" };

  // Overall cap: keep the newest across projects.
  const keep = new Set(
    read.flatMap((r) => r.hits).sort((a, b) => b.at - a.at).slice(0, PER_COLLECT_CAP).map((h) => h.hash)
  );

  const results = await Promise.all(
    read.map(async ({ p, hits, truncated }): Promise<
      { p: LocalProject; reason: ProjectSkipReason } | { p: LocalProject; commits: ProjectCommit[]; truncated: boolean }
    > => {
      const wanted = hits.filter((h) => keep.has(h.hash));
      const commits: ProjectCommit[] = [];
      if (wanted.length > 0) {
        const res = await runGit(p.root, [
          "show", "-s", "--no-notes", "--format=%H%x1f%an%x1f%ae%x1f%at%x1f%s%x1f%b%x1e",
          ...wanted.map((h) => h.hash),
        ]);
        if (!res.ok) return { p, reason: res.reason as ProjectSkipReason };
        for (const rec of res.stdout.split("\x1e")) {
          const [hash, an, ae, at, subject, body] = rec.replace(/^\n/, "").split("\x1f");
          if (!hash || !at) continue;
          commits.push({
            projectId: p.id,
            projectName: p.name,
            hash,
            shortHash: hash.slice(0, 7),
            subject: sanitize(subject ?? "", 200),
            body: sanitize(body ?? "", 1000),
            authorEmail: (ae ?? "").toLowerCase(),
            authorName: sanitize(an ?? "", 200),
            authorEpochMs: Number(at) * 1000,
          });
        }
        commits.sort((a, b) => b.authorEpochMs - a.authorEpochMs);
      }
      return { p, commits, truncated: truncated || wanted.length < hits.length };
    })
  );

  const out: { id: string; name: string; commits: ProjectCommit[]; truncated: boolean }[] = [];
  for (const r of results) {
    if ("reason" in r) skipped.push({ id: r.p.id, name: r.p.name, reason: r.reason });
    else out.push({ id: r.p.id, name: r.p.name, commits: r.commits, truncated: r.truncated });
  }
  return { ok: true, date, timeZone, projects: out, skipped };
}
