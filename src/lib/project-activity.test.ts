/**
 * Self-check for the commit activity block. Run: npx tsx src/lib/project-activity.test.ts
 * This text goes into the user's draft and the AI: no paths or emails may leak,
 * and repeated fetches must not stack copies.
 */

import assert from "node:assert";
import { buildActivityBlock, insertActivity } from "./project-activity";
import type { ProjectCollectResult, ProjectCommit } from "@/types";

type Found = Extract<ProjectCollectResult, { ok: true }>;

const at = (iso: string) => new Date(iso).getTime();
const commit = (over: Partial<ProjectCommit>): ProjectCommit => ({
  projectId: "p1",
  projectName: "Narad-Muni",
  hash: "a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0",
  shortHash: "a1b2c3d",
  subject: "feat: add leave marker",
  body: "",
  authorEmail: "me@example.com",
  authorName: "Me",
  authorEpochMs: at("2026-10-01T10:42:00+05:30"),
  ...over,
});

const result: Found = {
  ok: true,
  date: "2026-10-01",
  timeZone: "Asia/Kolkata",
  projects: [
    {
      id: "p1",
      name: "Narad-Muni",
      truncated: false,
      commits: [
        commit({ shortHash: "e4f5a6b", subject: "fix: guard empty autosave", authorEpochMs: at("2026-10-01T14:05:00+05:30") }),
        commit({ body: "Implements the leave flow.\n\nRefs NM-12 and NM-12 again" }),
      ],
    },
    {
      id: "p2",
      name: "Other-Repo",
      truncated: false,
      commits: [commit({ projectId: "p2", projectName: "Other-Repo", shortHash: "0c1d2e3", subject: "docs: update readme\u0007\u001b[31m", authorEpochMs: at("2026-10-01T16:20:00+05:30") })],
    },
    { id: "p3", name: "Quiet", truncated: false, commits: [] },
  ],
  skipped: [],
};

const block = buildActivityBlock(result);
assert.strictEqual(
  block,
  [
    "[Project activity · 2026-10-01 · Asia/Kolkata]",
    "Narad-Muni",
    "- 10:42 feat: add leave marker (a1b2c3d) · refs NM-12",
    "- 14:05 fix: guard empty autosave (e4f5a6b)",
    "Other-Repo",
    "- 16:20 docs: update readme[31m (0c1d2e3)",
    "[/Project activity]",
  ].join("\n"),
  "format, oldest first, tickets from the body, control characters stripped, empty projects omitted"
);
assert.ok(!block.includes("@"), "no email");
assert.ok(!block.includes("/Users"), "no path");
assert.ok(!block.includes("Implements"), "no body text");

// A ticket already in the subject is not repeated.
const inSubject = buildActivityBlock({ ...result, projects: [{ id: "p1", name: "R", truncated: false, commits: [commit({ subject: "NM-7: wire it", body: "NM-7 NM-8" })] }] });
assert.ok(inSubject.includes("- 10:42 NM-7: wire it (a1b2c3d) · refs NM-8\n"), inSubject);

// Insertion.
assert.deepStrictEqual(insertActivity("", block, "append"), { text: block, refreshed: false }, "append to empty");
assert.deepStrictEqual(insertActivity("Met the team.\n\n", block, "append"), { text: `Met the team.\n\n${block}`, refreshed: false }, "append to text");
assert.deepStrictEqual(insertActivity("Met the team.", block, "replace"), { text: block, refreshed: false }, "replace");

const older = block.replace("10:42", "09:00");
const draft = `Before.\n\n${older}\n\nAfter, blocked on review.`;
assert.deepStrictEqual(
  insertActivity(draft, block, "append"),
  { text: `Before.\n\n${block}\n\nAfter, blocked on review.`, refreshed: true },
  "same-date block is swapped in place"
);

const otherDay = buildActivityBlock({ ...result, date: "2026-09-30" });
assert.deepStrictEqual(
  insertActivity(otherDay, block, "append"),
  { text: `${otherDay}\n\n${block}`, refreshed: false },
  "a different date's block is kept and the new one appended"
);

console.log("project-activity: all assertions passed");
