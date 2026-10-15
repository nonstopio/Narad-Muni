import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import { NextRequest } from "next/server";

async function main() {
  initializeApp({ projectId: "narada-fixture" });
  const { adminDb, adminAuth } = await import("../../../lib/firebase-admin");
  type Data = Record<string, unknown>;
  const records = new Map<string, Data>();
  const clone = (value: Data) => JSON.parse(JSON.stringify(value)) as Data;
  const snapshot = (id: string, value?: Data) => ({ id, exists: !!value, data: () => value ? clone(value) : undefined });
  class Ref {
    constructor(public path: string) {}
    get id() { return this.path.split("/").at(-1)!; }
    async get() { return snapshot(this.id, records.get(this.path)); }
    collection(name: string) { return new Query(`${this.path}/${name}`); }
    async update(value: Data) { assert.ok(records.has(this.path), "update must exist"); records.set(this.path, { ...records.get(this.path), ...clone(value) }); }
    async delete() { records.delete(this.path); }
  }
  class Query {
    conditions: [string, string, unknown][] = [];
    fields: string[] | null = null;
    count = Infinity;
    constructor(public path: string) {}
    doc(id: string) { return new Ref(`${this.path}/${id}`); }
    where(field: string, operator: string, value: unknown) { const q = this.copy(); q.conditions.push([field, operator, value]); return q; }
    select(...fields: string[]) { const q = this.copy(); q.fields = fields; return q; }
    orderBy() { return this; }
    limit(count: number) { const q = this.copy(); q.count = count; return q; }
    copy() { const q = new Query(this.path); q.conditions = [...this.conditions]; q.fields = this.fields; q.count = this.count; return q; }
    async get() {
      const docs = [...records].filter(([key]) => key.startsWith(this.path + "/") && !key.slice(this.path.length + 1).includes("/"))
        .filter(([, value]) => this.conditions.every(([field, op, expected]) => op === "==" ? value[field] === expected : op === ">=" ? String(value[field]) >= String(expected) : String(value[field]) < String(expected)))
        .slice(0, this.count).map(([key, value]) => snapshot(key.split("/").at(-1)!, this.fields ? Object.fromEntries(this.fields.map((field) => [field, value[field]])) : value));
      return { docs, empty: docs.length === 0 };
    }
  }
  Object.defineProperty(adminDb, "collection", { value: (name: string) => new Query(name) });
  // Serial in-memory transactions model one winning claim without calling production Firestore.
  let transactionTail = Promise.resolve();
  Object.defineProperty(adminDb, "runTransaction", { value: (callback: (tx: unknown) => Promise<unknown>) => {
    const result = transactionTail.then(() => callback({
      get: (ref: Ref | Query) => ref.get(),
      create: (ref: Ref, value: Data) => { assert.ok(!records.has(ref.path)); records.set(ref.path, clone(value)); },
      set: (ref: Ref, value: Data, options?: { merge: boolean }) => records.set(ref.path, { ...(options?.merge ? records.get(ref.path) : {}), ...clone(value) }),
      update: (ref: Ref, value: Data) => { assert.ok(records.has(ref.path)); records.set(ref.path, { ...records.get(ref.path), ...clone(value) }); },
      delete: (ref: Ref) => records.delete(ref.path),
    }));
    transactionTail = result.then(() => {}, () => {});
    return result;
  } });
  Object.defineProperty(adminAuth, "verifyIdToken", { value: async () => ({ uid: "fixture", email: "fixture@example.invalid" }) });
  const { POST, PUT, GET, DELETE } = await import("./route");
  const userRoot = "users/fixture";
  records.set(`${userRoot}/configs/SLACK`, { isActive: true, webhookUrl: "https://fixture.invalid/slack" });
  records.set(`${userRoot}/configs/TEAMS`, { isActive: true, webhookUrl: "https://fixture.invalid/teams" });
  records.set(`${userRoot}/configs/JIRA`, { isActive: true, baseUrl: "https://fixture.invalid/jira", email: "fixture", apiToken: "fixture", timezone: "Asia/Kolkata" });
  const request = (method: string, body?: Data, query = "") => new NextRequest(`http://localhost/api/updates${query}`, { method, headers: { authorization: "Bearer fixture", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const input = (date: string) => ({ date, rawTranscript: "Completed work", slackOutput: "Slack words", teamsOutput: "Teams words", slackEnabled: true, teamsEnabled: true, jiraEnabled: true, workLogEntries: [
    { issueKey: "PROJ-1", timeSpentSecs: 1800, started: `${date}T10:00:00`, comment: "First", isRepeat: false },
    { issueKey: "PROJ-2", timeSpentSecs: 1800, started: `${date}T10:30:00`, comment: "Second", isRepeat: false },
  ] });
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  let blockFirst = true;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  let active = 0;
  let maxActive = 0;
  globalThis.fetch = async (url) => {
    calls.push(String(url)); active++; maxActive = Math.max(active, maxActive);
    if (blockFirst && calls.length <= 3) { if (calls.length === 3) release(); await barrier; }
    active--;
    if (String(url).endsWith("worklog")) return Response.json({ id: String(calls.length) });
    return new Response("ok");
  };
  try {
    const body = input("2026-10-15");
    const [first, duplicate] = await Promise.all([POST(request("POST", body)), POST(request("POST", body))]);
    assert.equal(first.status, 200); assert.equal(duplicate.status, 200);
    assert.ok(maxActive >= 3, "Slack, Teams and first Jira entry start before any response");
    const conflict = await POST(request("POST", { ...body, rawTranscript: "Different unsent work" }));
    assert.equal(conflict.status, 409, "different content on the same day is never acknowledged as published");
    assert.equal(calls.length, 4, "concurrent POSTs create only one set of external posts");
    const posted = (await first.json()).update;
    assert.equal(posted.slackStatus, "SENT"); assert.equal(posted.jiraStatus, "SENT");
    await PUT(request("PUT", { updateId: body.date, retrySlack: true, retryTeams: true, retryJira: true, workLogEntries: body.workLogEntries }));
    assert.equal(calls.length, 4, "server receipts suppress forged retries of SENT platforms");

    blockFirst = false;
    const partial = input("2026-10-16");
    globalThis.fetch = async (url) => {
      calls.push(String(url));
      if (String(url).includes("PROJ-2")) return new Response("rate limit", { status: 429 });
      return String(url).endsWith("worklog") ? Response.json({ id: "saved-immediately" }) : new Response("ok");
    };
    const partialResult = (await (await POST(request("POST", partial))).json()).update;
    assert.equal(partialResult.jiraStatus, "FAILED");
    assert.equal(partialResult.workLogEntries[0].jiraWorklogId, "saved-immediately");
    const beforeRetry = calls.length;
    globalThis.fetch = async (url, options) => {
      calls.push(String(url));
      const payload = JSON.parse(String(options?.body));
      assert.equal(payload.started, "2026-10-16T05:00:00.000+0000", "retry preserves the user's wall-clock timezone");
      return Response.json({ id: "second-receipt" });
    };
    const retry = await PUT(request("PUT", { updateId: partial.date, retrySlack: true, retryTeams: true, retryJira: true, workLogEntries: [...partialResult.workLogEntries, { ...partial.workLogEntries[1], issueKey: "PROJ-3" }] }));
    assert.equal(retry.status, 200);
    assert.equal(calls.length, beforeRetry + 2, "retry sends the rejected entry and the new row, never the receipted entry");
    assert.equal((await retry.json()).update.jiraStatus, "SENT");

    const ambiguous = { ...input("2026-10-17"), jiraEnabled: false, teamsEnabled: false };
    globalThis.fetch = async (url) => { calls.push(String(url)); throw new Error("response lost"); };
    const ambiguousResult = (await (await POST(request("POST", ambiguous))).json()).update;
    assert.equal(ambiguousResult.slackStatus, "UNCERTAIN");
    const beforeAmbiguousRetry = calls.length;
    await PUT(request("PUT", { updateId: ambiguous.date, retrySlack: true }));
    assert.equal(calls.length, beforeAmbiguousRetry, "uncertain posts never repeat");
    const deletion = await DELETE(request("DELETE", undefined, `?id=${ambiguous.date}`));
    assert.equal(deletion.status, 409, "unresolved deliveries cannot be erased");

    const pendingDate = "2026-10-18";
    const pendingId = "pending-generation";
    records.set(`${userRoot}/updates/${pendingDate}`, { ...ambiguousResult, date: `${pendingDate}T00:00:00.000Z`, slackStatus: "PENDING", deliveryId: pendingId });
    globalThis.fetch = async (url) => { calls.push(String(url)); return new Response("ok"); };
    const unclaimedBefore = calls.length;
    const resumed = await PUT(request("PUT", { updateId: pendingDate, retrySlack: true }));
    assert.equal((await resumed.json()).update.slackStatus, "SENT");
    assert.equal(calls.length, unclaimedBefore + 1, "a pending platform with no send claim resumes safely");

    const interruptedDate = "2026-10-19";
    records.set(`${userRoot}/updates/${interruptedDate}`, { ...ambiguousResult, date: `${interruptedDate}T00:00:00.000Z`, slackStatus: "PENDING", deliveryId: "interrupted" });
    records.set(`${userRoot}/updates/${interruptedDate}/deliveries/interrupted-slack`, { state: "SENDING" });
    const interruptedBefore = calls.length;
    const interrupted = await PUT(request("PUT", { updateId: interruptedDate, retrySlack: true }));
    assert.equal((await interrupted.json()).update.slackStatus, "UNCERTAIN");
    assert.equal(calls.length, interruptedBefore, "an interrupted send claim never repeats after restart");

    // Explicitly deleting a resolved update is a new user action, not a retry.
    assert.equal((await DELETE(request("DELETE", undefined, "?id=2026-10-15"))).status, 200);
    globalThis.fetch = async (url) => { calls.push(String(url)); return String(url).endsWith("worklog") ? Response.json({ id: "new-generation" }) : new Response("ok"); };
    const replacement = (await (await POST(request("POST", body))).json()).update;
    assert.notEqual(replacement.deliveryId, posted.deliveryId, "a new explicit publish cannot inherit stale receipts");
    assert.equal(replacement.slackStatus, "SENT");

    const dashboard = await GET(request("GET", undefined, "?dashboard=1&month=2026-10&today=2026-10-17"));
    const dashboardData = await dashboard.json();
    assert.equal(dashboardData.streak, 3); assert.equal(dashboardData.updates.length, 5);
    console.log("updates route: parallel publishing, duplicate POSTs, partial Jira retry, ambiguous delivery and dashboard passed");
  } finally { globalThis.fetch = originalFetch; }
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
