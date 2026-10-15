export type DeliveryState = "SENT" | "FAILED" | "UNCERTAIN";
export interface DeliveryLedger {
  claim: () => Promise<"claimed" | DeliveryState>;
  finish: (state: DeliveryState) => Promise<void>;
}
/** Only a definite rejection is safe to retry. Lost responses may have delivered the post. */
export class RejectedDelivery extends Error {}
export async function deliverOnce(ledger: DeliveryLedger, send: () => Promise<void>): Promise<DeliveryState> {
  const claim = await ledger.claim();
  if (claim !== "claimed") return claim;
  let state: DeliveryState = "SENT";
  try { await send(); }
  catch (err) {
    console.error("[Narada] Delivery:", err);
    state = err instanceof RejectedDelivery ? "FAILED" : "UNCERTAIN";
  }
  // A receipt failure leaves the durable claim blocked; never repeat the external side effect.
  await ledger.finish(state);
  return state;
}
export async function deliveryFetch(url: string, options: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    const message = `Delivery rejected (${res.status})`;
    if (res.status >= 400 && res.status < 500 && res.status !== 408) throw new RejectedDelivery(message);
    throw new Error(message);
  }
  return res;
}

export interface RetryEntry {
  id: string;
  jiraWorklogId: string | null;
  [key: string]: unknown;
}
/** Receipts come from the server, never from an editable client payload. */
export function mergeRetryEntries<T extends RetryEntry>(existing: T[], incoming: Partial<T>[]): T[] {
  const unposted = existing.filter((e) => !e.jiraWorklogId);
  const used = new Set<string>();
  const edits = incoming.filter((e) => !e.jiraWorklogId).map((patch) => {
    const original = patch.id ? unposted.find((e) => e.id === patch.id) : { id: crypto.randomUUID(), jiraWorklogId: null };
    if (!original || used.has(original.id)) throw new RejectedDelivery("Alas! These worklogs changed. Reopen the saved scroll before retrying.");
    used.add(original.id);
    return { ...original, ...patch, id: original.id, jiraWorklogId: null };
  });
  return [...existing.filter((e) => e.jiraWorklogId), ...edits] as T[];
}
