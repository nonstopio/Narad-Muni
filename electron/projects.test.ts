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
  const file = `f${++n}.txt`; // one file per commit, so branches merge cleanly
  fs.writeFileSync(path.join(dir, file), subject);
  git(dir, ["add", file]);
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

    // ---- Stage 3: which commits belong to a day ---------------------------
    {
      const { store, setUid } = makeStore();
      setUid("uid-collect");
      const subjects = (r: Awaited<ReturnType<typeof store.collect>>, id: string) => {
        assert.ok(r.ok, `collect ok: ${JSON.stringify(r)}`);
        const p = r.projects.find((x) => x.id === id);
        assert.ok(p, "project in result");
        return p.commits.map((c) => c.subject).sort();
      };

      assert.deepStrictEqual(await store.collect({ date: "2026-10-01", timeZone: "Asia/Kolkata" }), { ok: false, error: "no-projects" });
      await assert.rejects(store.collect({ date: "2026-02-30", timeZone: "Asia/Kolkata" }), "invalid date");
      await assert.rejects(store.collect({ date: "2026-10-01", timeZone: "Nowhere/Land" }), "invalid timezone");

      const repo = newRepo("kolkata");
      const D = "2026-10-01";
      commit(repo, "start of day", { author: `${D}T00:00:00+05:30` });
      commit(repo, "next midnight", { author: "2026-10-02T00:00:00+05:30" });
      commit(repo, "last second", { author: `${D}T23:59:59+05:30` });
      commit(repo, "rebased later", { author: `${D}T10:00:00+05:30`, committer: "2026-10-04T10:00:00+05:30" });
      commit(repo, "authored day before", { author: "2026-09-30T23:00:00+05:30", committer: `${D}T09:00:00+05:30` });
      commit(repo, "someone else", { author: `${D}T11:00:00+05:30`, email: "someone@else.com" });
      commit(repo, "case-insensitive me", { author: `${D}T12:00:00+05:30`, email: "Me@Example.com" });
      commit(repo, "on many branches", { author: `${D}T13:00:00+05:30` });
      git(repo, ["branch", "feature"]);
      git(repo, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
      git(repo, ["checkout", "-q", "-b", "side"]);
      commit(repo, "side work", { author: `${D}T14:00:00+05:30` });
      git(repo, ["checkout", "-q", "main"]);
      commit(repo, "main after side", { author: "2026-10-03T10:00:00+05:30" });
      git(repo, ["merge", "--no-ff", "-q", "-m", "merge side", "side"], {
        GIT_AUTHOR_DATE: `${D}T15:00:00+05:30`, GIT_COMMITTER_DATE: `${D}T15:00:00+05:30`,
        GIT_AUTHOR_EMAIL: ME, GIT_COMMITTER_EMAIL: ME,
      });
      const before = snapshot(repo);

      const added = (await store.add(repo)) as { project: { id: string } };
      const kolkata = added.project.id;
      const r = await store.collect({ date: D, timeZone: "Asia/Kolkata" });
      assert.deepStrictEqual(subjects(r, kolkata), [
        "case-insensitive me", "last second", "on many branches", "rebased later", "side work", "start of day",
      ]);
      // Same instants, read in another zone, land on other days.
      assert.ok(!subjects(await store.collect({ date: D, timeZone: "America/Los_Angeles" }), kolkata).includes("start of day"));

      const c = (r as Extract<typeof r, { ok: true }>).projects[0].commits[0];
      assert.strictEqual(c.shortHash, c.hash.slice(0, 7));
      assert.strictEqual(c.authorEmail, ME);
      assert.ok(c.authorEpochMs > 0);

      // Read-only: nothing fetched, no ref/config/hook/index change.
      assert.deepStrictEqual(snapshot(repo), before, "collect changes nothing in the repo");
      assert.ok(!fs.existsSync(path.join(repo, ".git", "FETCH_HEAD")), "no remote fetch");

      // DST in Europe/London: a 23h day and a 25h day.
      const london = newRepo("london");
      commit(london, "spring 00:30 GMT", { author: "2026-03-29T00:30:00+00:00" });
      commit(london, "spring 23:30 BST", { author: "2026-03-29T23:30:00+01:00" });
      commit(london, "next day 00:30 BST", { author: "2026-03-30T00:30:00+01:00" });
      commit(london, "autumn 01:30 BST", { author: "2026-10-25T01:30:00+01:00" });
      commit(london, "autumn 01:30 GMT", { author: "2026-10-25T01:30:00+00:00" });
      const lid = ((await store.add(london)) as { project: { id: string } }).project.id;
      assert.deepStrictEqual(subjects(await store.collect({ date: "2026-03-29", timeZone: "Europe/London" }), lid), [
        "spring 00:30 GMT", "spring 23:30 BST",
      ]);
      assert.deepStrictEqual(subjects(await store.collect({ date: "2026-10-25", timeZone: "Europe/London" }), lid), [
        "autumn 01:30 BST", "autumn 01:30 GMT",
      ]);

      // Partial failure: one root gone, the other still reads.
      fs.rmSync(london, { recursive: true, force: true });
      const partial = await store.collect({ date: D, timeZone: "Asia/Kolkata" });
      assert.ok(partial.ok);
      assert.strictEqual(partial.projects.length, 1);
      assert.deepStrictEqual(partial.skipped, [{ id: lid, name: "london", reason: "missing-folder" }]);

      // Every enabled project failing is all-failed; none enabled is none-enabled.
      store.update({ id: kolkata, enabled: false });
      assert.deepStrictEqual(await store.collect({ date: D, timeZone: "Asia/Kolkata" }), { ok: false, error: "all-failed" });
      store.update({ id: lid, enabled: false });
      assert.deepStrictEqual(await store.collect({ date: D, timeZone: "Asia/Kolkata" }), { ok: false, error: "none-enabled" });

      // A project without an author email is skipped, never read for all authors.
      store.update({ id: kolkata, enabled: true, authorEmails: [] });
      const noEmail = await store.collect({ date: D, timeZone: "Asia/Kolkata" });
      assert.ok(noEmail.ok);
      assert.deepStrictEqual(noEmail.projects, []);
      assert.strictEqual(noEmail.skipped[0].reason, "no-author-email");

      // Overlap is refused while a collect is in flight.
      store.update({ id: kolkata, authorEmails: [ME] });
      const first = store.collect({ date: D, timeZone: "Asia/Kolkata" });
      assert.deepStrictEqual(await store.collect({ date: D, timeZone: "Asia/Kolkata" }), { ok: false, error: "busy" });
      assert.ok((await first).ok);
    }

    // ---- Stage 3: caps ------------------------------------------------------
    {
      const { store, setUid } = makeStore();
      setUid("uid-busy-day");
      const repo = newRepo("busy-day");
      for (let i = 0; i < 55; i++) {
        commit(repo, `deed ${String(i).padStart(2, "0")}`, { author: `2026-05-05T09:${String(i).padStart(2, "0")}:00+00:00` });
      }
      const id = ((await store.add(repo)) as { project: { id: string } }).project.id;
      const r = await store.collect({ date: "2026-05-05", timeZone: "UTC" });
      assert.ok(r.ok);
      const p = r.projects.find((x) => x.id === id)!;
      assert.strictEqual(p.commits.length, 50);
      assert.strictEqual(p.truncated, true);
      assert.strictEqual(p.commits[0].subject, "deed 54", "newest first");
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
