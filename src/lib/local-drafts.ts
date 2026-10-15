import { auth } from "./firebase";
import { authedFetch } from "./api-client";
import type { DraftSource, WorkLogEntryData, UpdateMetricsHints } from "@/types";

export interface LocalDraft {
  rawTranscript: string;
  draftSource: DraftSource;
  workedHours: number;
  slackOutput: string;
  teamsOutput: string;
  workLogEntries: WorkLogEntryData[];
  previewReady: boolean;
  metricsHints: UpdateMetricsHints | null;
  revision: string;
  syncedRevision?: string;
  deleted?: boolean;
  retryUpdateId?: string | null;
  slackEnabled?: boolean;
  teamsEnabled?: boolean;
  jiraEnabled?: boolean;
  cloudReady?: boolean;
}

function owner() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}
function prefix() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");
  return `narada.drafts.${uid}.`;
}
function unwrap<T>(result: { value?: T; error?: string }): T | undefined {
  if (result.error) throw new Error(result.error);
  return result.value;
}
export function readLocalDraft(date: string): LocalDraft | null {
  if (window.narada?.drafts) return (unwrap(window.narada.drafts.read(owner(), date)) as LocalDraft | null) ?? null;
  return JSON.parse(localStorage.getItem(prefix() + date) ?? "null");
}
export function writeLocalDraft(date: string, draft: LocalDraft): void {
  if (window.narada?.drafts) unwrap(window.narada.drafts.write(owner(), date, draft));
  else localStorage.setItem(prefix() + date, JSON.stringify(draft));
}
export function localDraftDates(): string[] {
  if (window.narada?.drafts) return unwrap(window.narada.drafts.list(owner())) ?? [];
  const keyPrefix = prefix();
  return Object.keys(localStorage).filter((key) => key.startsWith(keyPrefix)).map((key) => key.slice(keyPrefix.length));
}

const inFlight = new Map<string, Promise<void>>();
/** Serialize per day and acknowledge only the exact revision that reached the cloud. */
export function syncLocalDraft(date: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  const key = `${uid}:${date}`;
  const running = inFlight.get(key);
  if (running) return running;
  const promise = (async () => {
    while (auth.currentUser?.uid === uid) {
      const draft = readLocalDraft(date);
      if (!draft || draft.revision === draft.syncedRevision) return;
      if (draft.cloudReady === false) return; // Do not delete an unseen cloud draft while restoring metadata.
      if (draft.retryUpdateId) return; // Retry previews are local; never recreate a published cloud draft.
      const res = await authedFetch(draft.deleted ? `/api/drafts?date=${date}` : "/api/drafts", {
        method: draft.deleted ? "DELETE" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: draft.deleted ? undefined : JSON.stringify({ date, rawTranscript: draft.rawTranscript, source: draft.draftSource }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (auth.currentUser?.uid !== uid) return;
      const latest = readLocalDraft(date);
      if (latest?.revision === draft.revision) {
        if (latest.deleted) {
          if (window.narada?.drafts) unwrap(window.narada.drafts.remove(owner(), date));
          else localStorage.removeItem(prefix() + date);
        } else writeLocalDraft(date, { ...latest, syncedRevision: draft.revision });
        return;
      }
    }
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

export async function syncPendingDrafts(): Promise<void> {
  for (const date of localDraftDates()) {
    try { await syncLocalDraft(date); }
    catch (err) { console.warn("[Narada] Draft remains safe locally:", err); }
  }
}

/** A publish acknowledges only the submitted revision, never edits made during delivery. */
export function retireLocalDraft(date: string, revision: string | undefined, uid: string | undefined): boolean {
  if (!uid || auth.currentUser?.uid !== uid) return false;
  const current = readLocalDraft(date);
  if (!current || current.revision !== revision) return false;
  writeLocalDraft(date, { ...current, rawTranscript: "", previewReady: false, retryUpdateId: null, revision: crypto.randomUUID(), deleted: true });
  syncLocalDraft(date).catch(() => {});
  return true;
}

export function canRevalidateDraft(draft: LocalDraft | null): boolean {
  return !draft || (!draft.deleted && !draft.retryUpdateId && draft.revision === draft.syncedRevision);
}
