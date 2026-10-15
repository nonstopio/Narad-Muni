import assert from "node:assert/strict";
import { authedFetch } from "./api-client";
import { auth } from "./firebase";
import { readLocalDraft, writeLocalDraft, syncLocalDraft, retireLocalDraft, canRevalidateDraft, type LocalDraft } from "./local-drafts";

async function main() {
  await auth.authStateReady();
  const storage: Record<string, string> = {};
  Object.defineProperties(storage, {
    getItem: { value: (key: string) => storage[key] ?? null },
    setItem: { value: (key: string, value: string) => { storage[key] = value; } },
    removeItem: { value: (key: string) => { delete storage[key]; } },
  });
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
  const alice = { uid: "alice", getIdToken: async () => "fixture" };
  Object.defineProperty(auth, "currentUser", { value: alice, writable: true, configurable: true });
  const date = "2026-10-15";
  const draft: LocalDraft = { rawTranscript: "First", draftSource: "manual", workedHours: 8, slackOutput: "Preview", teamsOutput: "", workLogEntries: [], previewReady: true, metricsHints: null, revision: "1" };
  const originalFetch = globalThis.fetch;
  const sent: { method?: string; body?: string }[] = [];
  try {
    assert.equal(canRevalidateDraft({ ...draft, syncedRevision: "1" }), true, "clean drafts revalidate");
    assert.equal(canRevalidateDraft(draft), false, "dirty drafts retain local edits");
    writeLocalDraft(date, { ...draft, revision: "new" });
    assert.equal(retireLocalDraft(date, "1", "alice"), false, "publish completion preserves edits made during dispatch");
    assert.equal(readLocalDraft(date)?.revision, "new");
    Object.defineProperty(window, "narada", { value: { drafts: { read: (uid: string) => ({ error: uid === "alice" ? "draft-owner-mismatch" : "unexpected" }) } }, configurable: true });
    let unsafeFetches = 0;
    globalThis.fetch = async () => { unsafeFetches++; return Response.json({}); };
    await assert.rejects(syncLocalDraft(date), /owner-mismatch/);
    assert.equal(unsafeFetches, 0, "native account mismatch never uploads another owner's draft");
    Object.defineProperty(window, "narada", { value: undefined, configurable: true });
    writeLocalDraft(date, draft);
    globalThis.fetch = async () => new Response("offline", { status: 503 });
    await assert.rejects(syncLocalDraft(date));
    assert.equal(readLocalDraft(date)?.syncedRevision, undefined, "failure never acknowledges an unsaved draft");
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    globalThis.fetch = async (_url, options) => {
      sent.push({ method: options?.method, body: typeof options?.body === "string" ? options.body : undefined });
      if (sent.length === 1) await barrier;
      return Response.json({ success: true });
    };
    const pending = syncLocalDraft(date);
    await new Promise((resolve) => setTimeout(resolve, 0));
    writeLocalDraft(date, { ...draft, rawTranscript: "Newer edit", revision: "2" });
    assert.equal(syncLocalDraft(date), pending, "concurrent saves coalesce");
    release(); await pending;
    assert.equal(sent.length, 2, "newer revision follows the old save serially");
    assert.equal(JSON.parse(sent[1].body!).rawTranscript, "Newer edit");
    assert.equal(readLocalDraft(date)?.syncedRevision, "2");
    await syncLocalDraft(date); assert.equal(sent.length, 2, "acknowledged draft is not saved again");

    sent.length = 0;
    let deleteRelease!: () => void;
    const deleteBarrier = new Promise<void>((resolve) => { deleteRelease = resolve; });
    globalThis.fetch = async (_url, options) => {
      sent.push({ method: options?.method });
      if (sent.length === 1) await deleteBarrier;
      return Response.json({ success: true });
    };
    writeLocalDraft(date, { ...draft, revision: "3" });
    const saving = syncLocalDraft(date);
    await new Promise((resolve) => setTimeout(resolve, 0));
    writeLocalDraft(date, { ...draft, revision: "4", deleted: true });
    deleteRelease(); await saving;
    assert.deepEqual(sent.map((request) => request.method), ["PUT", "DELETE"], "deletion follows the in-flight save, never resurrecting it");
    assert.equal(readLocalDraft(date), null, "acknowledged deletion retires the tombstone and avoids scanning published history");

    sent.length = 0;
    writeLocalDraft(date, { ...draft, revision: "5", cloudReady: false });
    await syncLocalDraft(date); assert.equal(sent.length, 0, "unseen cloud drafts cannot be deleted by metadata initialization");
    writeLocalDraft(date, { ...draft, revision: "6", retryUpdateId: "published" });
    await syncLocalDraft(date); assert.equal(sent.length, 0, "retry previews never recreate cloud drafts");
    let releaseToken!: (token: string) => void;
    const token = new Promise<string>(resolve => { releaseToken = resolve; });
    Object.defineProperty(auth, "currentUser", { value: { uid: "alice", getIdToken: () => token }, configurable: true });
    const staleRequest = authedFetch("/api/drafts");
    Object.defineProperty(auth, "currentUser", { value: { ...alice, uid: "bob" } });
    const callsBefore = sent.length;
    releaseToken("old-account-token");
    await assert.rejects(staleRequest, /Account changed/);
    assert.equal(sent.length, callsBefore, "account switch during token refresh cancels network dispatch");
    assert.equal(readLocalDraft(date), null, "another account cannot see the draft");
    console.log("local-drafts: failed acknowledgement, coalescing, revision order, tombstones and isolation passed");
  } finally { globalThis.fetch = originalFetch; }
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
