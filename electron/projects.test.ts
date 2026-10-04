/**
 * Self-check for local git projects. Run: npx tsx electron/projects.test.ts
 * Builds throwaway repos in the temp dir. A failure here means a duplicated or
 * missed commit in someone's daily update, or a repo Narad touched when it must not.
 */

import assert from "node:assert";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createProjectStore } from "./projects";

// Keep the developer's own git config (global user.email, hooks) out of the repos under test.
process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_NOSYSTEM = "1";

const ME = "me@example.com";
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "narada-projects-")));

function git(cwd: string, args: string[], env: Record<string, string> = {}): string {
  return execFileSync("git", args, { cwd, env: { ...process.env, ...env }, encoding: "utf-8" });
}

function newRepo(name: string, email: string | null = ME): string {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir, { recursive: true });
  git(dir, ["init", "-q", "-b", "main"]);
  if (email) git(dir, ["config", "user.email", email]);
  git(dir, ["config", "user.name", "Me"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  return dir;
}

let n = 0;
function commit(dir: string, subject: string, opts: { author?: string; committer?: string; email?: string; body?: string } = {}) {
  const at = opts.author ?? "2026-01-01T12:00:00+00:00";
  const email = opts.email ?? ME;
  fs.writeFileSync(path.join(dir, "f.txt"), String(++n));
  git(dir, ["add", "f.txt"]);
  const msg = opts.body ? `${subject}\n\n${opts.body}` : subject;
  git(dir, ["commit", "-q", "-m", msg], {
    GIT_AUTHOR_DATE: at,
    GIT_COMMITTER_DATE: opts.committer ?? at,
    GIT_AUTHOR_EMAIL: email,
    GIT_COMMITTER_EMAIL: email,
    GIT_AUTHOR_NAME: "Me",
    GIT_COMMITTER_NAME: "Me",
  });
  return git(dir, ["rev-parse", "HEAD"]).trim();
}

/** Everything a read-only tool must leave exactly as it found it. */
function snapshot(dir: string) {
  return {
    refs: git(dir, ["for-each-ref"]),
    config: git(dir, ["config", "--list", "--local"]),
    hooks: fs.readdirSync(path.join(dir, ".git", "hooks")).sort().join(","),
    // The check itself must not refresh the index.
    status: git(dir, ["status", "--porcelain"], { GIT_OPTIONAL_LOCKS: "0" }),
    indexMtime: fs.statSync(path.join(dir, ".git", "index")).mtimeMs,
  };
}

function makeStore() {
  let uid: string | undefined = "uid-a";
  const store = createProjectStore({ filePath: path.join(tmp, "userData", "projects.json"), getUid: () => uid });
  return { store, setUid: (u: string | undefined) => (uid = u) };
}

async function main() {
  try {
    // ---- Stage 2: settings store ----------------------------------------
    {
      const { store, setUid } = makeStore();
      const repo = newRepo("store-repo");
      commit(repo, "init");
      fs.mkdirSync(path.join(repo, "sub"));
      fs.writeFileSync(path.join(repo, "sub", ".keep"), "");
      git(repo, ["add", "sub"]);
      commit(repo, "sub");
      const before = snapshot(repo);

      const added = await store.add(repo);
      assert.ok("project" in added && added.project, "add a repo");
      const project = (added as { project: { id: string; name: string; root: string; authorEmails: string[] } }).project;
      assert.strictEqual(project.name, "store-repo");
      assert.strictEqual(project.root, repo);
      assert.deepStrictEqual(project.authorEmails, [ME], "default email is the repo-local user.email");

      const sub = await store.add(path.join(repo, "sub"));
      assert.deepStrictEqual(sub, { error: "duplicate", name: "store-repo" }, "subfolder of a listed repo");

      assert.deepStrictEqual(snapshot(repo), before, "adding a project changes nothing in the repo");
      assert.ok(!fs.existsSync(path.join(repo, ".git", "FETCH_HEAD")), "no fetch");

      const wt = path.join(tmp, "store-repo-wt");
      git(repo, ["worktree", "add", "-q", "-b", "wt-branch", wt]);
      assert.strictEqual((await store.add(wt) as { error?: string }).error, "duplicate", "linked worktree of a listed repo");

      const plain = path.join(tmp, "plain-folder");
      fs.mkdirSync(plain);
      assert.deepStrictEqual(await store.add(plain), { error: "not-a-repo" });

      const noEmail = newRepo("no-email-repo", null);
      const ne = (await store.add(noEmail)) as { project: { authorEmails: string[] } };
      assert.deepStrictEqual(ne.project.authorEmails, [], "unset email → []");

      // Update validation.
      const upd = store.update({ id: project.id, name: "  Renamed  ", enabled: false, authorEmails: ["A@B.com", "a@b.com"] }) as {
        project: { name: string; enabled: boolean; authorEmails: string[] };
      };
      assert.strictEqual(upd.project.name, "Renamed");
      assert.strictEqual(upd.project.enabled, false);
      assert.deepStrictEqual(upd.project.authorEmails, ["a@b.com"], "lowercased and deduped");
      assert.throws(() => store.update({ id: project.id, name: "" }));
      assert.throws(() => store.update({ id: project.id, name: "x".repeat(61) }));
      assert.throws(() => store.update({ id: project.id, authorEmails: ["not an email"] }));
      assert.throws(() => store.update({ id: "unknown", enabled: true }));
      assert.throws(() => store.setTimeZone("Mars/Olympus"));
      assert.deepStrictEqual(store.setTimeZone("Asia/Kolkata"), { workdayTimeZone: "Asia/Kolkata" });

      // Store isolation per signed-in user.
      assert.strictEqual((store.list() as { projects: unknown[] }).projects.length, 2);
      setUid("uid-b");
      assert.deepStrictEqual(store.list(), { workdayTimeZone: null, projects: [] }, "another account sees nothing");
      setUid(undefined);
      assert.deepStrictEqual(store.list(), { error: "signed-out" });
      setUid("uid-a");
      const back = store.list() as { workdayTimeZone: string; projects: { id: string }[] };
      assert.strictEqual(back.projects.length, 2, "first account's list is back");
      assert.strictEqual(back.workdayTimeZone, "Asia/Kolkata");

      assert.deepStrictEqual(store.remove(project.id), { ok: true });
      assert.deepStrictEqual(store.remove(project.id), { ok: true }, "remove is idempotent");
      assert.strictEqual((store.list() as { projects: unknown[] }).projects.length, 1);
    }

    console.log("projects: all assertions passed");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
