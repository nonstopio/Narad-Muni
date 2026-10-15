import assert from "node:assert/strict";
import { deliverOnce, RejectedDelivery, deliveryFetch, mergeRetryEntries, type DeliveryLedger, type DeliveryState } from "./publish-delivery";

async function main() {
  let state: string | null = null;
  let sends = 0;
  const ledger: DeliveryLedger = {
    claim: async () => {
      if (state === "SENT") return "SENT";
      if (state === "SENDING" || state === "UNCERTAIN") return "UNCERTAIN";
      state = "SENDING";
      return "claimed";
    },
    finish: async (value: DeliveryState) => { state = value; },
  };
  const results = await Promise.all(Array.from({ length: 5 }, () => deliverOnce(ledger, async () => { sends++; await new Promise((resolve) => setTimeout(resolve, 5)); })));
  assert.equal(sends, 1, "concurrent requests send exactly once");
  assert.ok(results.includes("SENT"));
  assert.equal(await deliverOnce(ledger, async () => { sends++; }), "SENT");
  assert.equal(sends, 1, "confirmed receipt suppresses retries");
  state = null;
  assert.equal(await deliverOnce(ledger, async () => { sends++; throw new Error("response lost after delivery"); }), "UNCERTAIN");
  const before = sends;
  assert.equal(await deliverOnce(ledger, async () => { sends++; }), "UNCERTAIN");
  assert.equal(sends, before, "ambiguous responses never resend");
  state = null;
  assert.equal(await deliverOnce(ledger, async () => { throw new RejectedDelivery("429"); }), "FAILED");
  assert.equal(await deliverOnce(ledger, async () => { sends++; }), "SENT", "definite rejection permits retry");
  state = "SENDING";
  assert.equal(await deliverOnce(ledger, async () => { sends++; }), "UNCERTAIN", "restart keeps an unfinished claim blocked");
  assert.equal(sends, before + 1);
  state = null;
  const brokenReceipt = { ...ledger, finish: async () => { throw new Error("disk unavailable"); } };
  await assert.rejects(deliverOnce(brokenReceipt, async () => { sends++; }));
  const count = sends;
  await deliverOnce(ledger, async () => { sends++; });
  assert.equal(sends, count, "failed receipt persistence keeps the send claim");

  const existing = [{ id: "posted", jiraWorklogId: "42", comment: "server" }, { id: "failed", jiraWorklogId: null, comment: "old" }];
  const merged = mergeRetryEntries(existing, [{ id: "posted", jiraWorklogId: "forged", comment: "changed" }, { id: "failed", comment: "edit" }]);
  assert.deepEqual(merged, [existing[0], { ...existing[1], comment: "edit" }]);
  assert.throws(() => mergeRetryEntries(existing, [{ id: "unknown" }]), /changed/);
  assert.throws(() => mergeRetryEntries(existing, [{ id: "failed" }, { id: "failed" }]), /changed/);
  const added = mergeRetryEntries(existing, [{ id: "failed", comment: "edit" }, { comment: "new row" }]);
  assert.equal(added.length, 3);
  assert.ok(added[2].id && added[2].id !== "failed");
  assert.equal(added[2].jiraWorklogId, null);
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("limited", { status: 429 });
    await assert.rejects(deliveryFetch("https://fixture.invalid", {}), RejectedDelivery);
    globalThis.fetch = async () => new Response("unknown", { status: 500 });
    await assert.rejects(deliveryFetch("https://fixture.invalid", {}), (err: unknown) => err instanceof Error && !(err instanceof RejectedDelivery));
  } finally { globalThis.fetch = originalFetch; }
  console.log("publish-delivery: concurrent, interrupted, ambiguous and confirmed retries passed");
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
