import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDraftStore } from "./drafts";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "narada-drafts-"));
let uid: string | undefined = "alice";
try {
  const store = createDraftStore(root, () => uid);
  const snapshot = { rawTranscript: "Last keystroke", slackOutput: "Edited preview", revision: "1" };
  store.write("2026-10-15", snapshot, "alice");
  // A fresh store stands in for a new Electron process, with no renderer state or cloud.
  const restarted = createDraftStore(root, () => uid);
  assert.deepEqual(restarted.read("2026-10-15", uid!), snapshot);
  assert.deepEqual(restarted.list(uid!), ["2026-10-15"]);
  for (const operation of [() => restarted.read("2026-10-15", "bob"), () => restarted.list("bob"), () => restarted.write("2026-10-15", {}, "bob"), () => restarted.remove("2026-10-15", "bob")]) assert.throws(operation, /owner-mismatch/);
  uid = "bob";
  assert.equal(restarted.read("2026-10-15", uid!), null);
  assert.deepEqual(restarted.list(uid!), []);
  uid = "alice";
  assert.throws(() => restarted.write("../../other", {}, "alice"), /invalid-date/);
  assert.throws(() => restarted.write("2026-10-15", "x".repeat(3 * 1024 * 1024), "alice"), /draft-too-large/);
  assert.deepEqual(restarted.read("2026-10-15", uid!), snapshot, "rejected writes preserve the last durable record");
  restarted.write("2026-10-15", { ...snapshot, revision: "2", rawTranscript: "" }, "alice");
  assert.equal((restarted.read("2026-10-15", uid!) as typeof snapshot).revision, "2");
  uid = undefined;
  assert.throws(() => restarted.read("2026-10-15", uid!), /signed-out/);
  console.log("drafts: restart, user isolation, atomic replacement and validation passed");
} finally { fs.rmSync(root, { recursive: true, force: true }); }
