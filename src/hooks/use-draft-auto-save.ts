"use client";

import { useLayoutEffect, useCallback, useRef } from "react";
import { useUpdateStore } from "@/stores/update-store";
import { useToastStore } from "@/components/ui/toast";
import { authedFetch } from "@/lib/api-client";
import { auth } from "@/lib/firebase";
import { readLocalDraft, writeLocalDraft, syncLocalDraft, retireLocalDraft, canRevalidateDraft, type LocalDraft } from "@/lib/local-drafts";

function snapshot(): Omit<LocalDraft, "revision"> {
  const s = useUpdateStore.getState();
  return {
    rawTranscript: s.rawTranscript, draftSource: s.draftSource, workedHours: s.workedHours,
    slackOutput: s.slackOutput, teamsOutput: s.teamsOutput, workLogEntries: s.workLogEntries,
    previewReady: s.previewReady, metricsHints: s.metricsHints,
    retryUpdateId: s.retryUpdateId,
    slackEnabled: s.slackEnabled, teamsEnabled: s.teamsEnabled, jiraEnabled: s.jiraEnabled,
  };
}

export function useDraftAutoSave(dateStr: string | null, enabled: boolean, cloudEnabled = enabled, retryId: string | null = null) {
  const cloudRef = useRef(cloudEnabled);
  useLayoutEffect(() => { cloudRef.current = cloudEnabled; }, [cloudEnabled]);

  useLayoutEffect(() => {
    if (!enabled || !dateStr) return;
    const date = dateStr;
    const uid = auth.currentUser?.uid;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let storageError = false;
    let local: LocalDraft | null = null;
    try {
      local = readLocalDraft(date);
      if (local && !local.deleted && (local.retryUpdateId ?? null) === retryId) {
        const editor = {
          rawTranscript: local.rawTranscript, draftSource: local.draftSource, workedHours: local.workedHours,
          slackOutput: local.slackOutput, teamsOutput: local.teamsOutput, workLogEntries: local.workLogEntries,
          previewReady: local.previewReady, metricsHints: local.metricsHints,
          ...(typeof local.slackEnabled === "boolean" ? { slackEnabled: local.slackEnabled } : {}),
          ...(typeof local.teamsEnabled === "boolean" ? { teamsEnabled: local.teamsEnabled } : {}),
          ...(typeof local.jiraEnabled === "boolean" ? { jiraEnabled: local.jiraEnabled } : {}),
        };
        useUpdateStore.setState(editor);
        if (retryId) useUpdateStore.setState({ retryUpdateId: retryId });
      }
    } catch (err) {
      console.error("[Narada] Local draft restore failed:", err);
      useToastStore.getState().addToast("Alas! I could not open your local scroll. I shall keep it untouched.", "error");
      return;
    }
    let previous = JSON.stringify(snapshot());
    const content = () => {
      const editable = snapshot();
      return JSON.stringify({ ...editable, slackEnabled: undefined, teamsEnabled: undefined, jiraEnabled: undefined });
    };
    let previousContent = content();
    let cloudLoaded = !!local && local.cloudReady !== false;
    let canRestoreCloud = canRevalidateDraft(local) || local?.cloudReady === false;
    const unsub = useUpdateStore.subscribe(() => {
      if (auth.currentUser?.uid !== uid) return;
      const editor = snapshot();
      const serialized = JSON.stringify(editor);
      if (serialized === previous) return;
      const nextContent = content();
      const contentChanged = nextContent !== previousContent;
      if (contentChanged) canRestoreCloud = false;
      previousContent = nextContent;
      try {
        const current = readLocalDraft(date);
        const revision = crypto.randomUUID();
        const keepClean = !contentChanged && !!current && canRevalidateDraft(current);
        writeLocalDraft(date, { ...editor, cloudReady: cloudLoaded || !canRestoreCloud, revision, ...(keepClean ? { syncedRevision: revision } : {}) });
        previous = serialized;
        storageError = false;
      } catch (err) {
        console.error("[Narada] Local draft save failed:", err);
        if (!storageError) useToastStore.getState().addToast("Alas! I could not preserve this scroll on your device. Keep the window open until storage returns.", "error");
        storageError = true;
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (cloudRef.current) syncLocalDraft(date).catch(() => {});
      }, 1500);
    });

    // Local content wins over a late cloud response, including a restored preview.
    let cloudRequest = 0;
    const restoreCloud = () => {
      if (!canRestoreCloud || retryId) return;
      const request = ++cloudRequest;
      authedFetch(`/api/drafts?date=${date}`, { signal: AbortSignal.timeout(15000) })
        .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
        .then((data) => {
          if (cancelled || request !== cloudRequest || auth.currentUser?.uid !== uid || !canRestoreCloud) return;
          cloudLoaded = true;
          canRestoreCloud = false;
          const rawTranscript = data.draft?.rawTranscript || "";
          const changed = rawTranscript !== useUpdateStore.getState().rawTranscript;
          useUpdateStore.setState({ rawTranscript, draftSource: data.draft?.source === "projects" ? "projects" : "manual", ...(changed ? { previewReady: false, slackOutput: "", teamsOutput: "", workLogEntries: [] } : {}) });
          const restored = readLocalDraft(date);
          if (restored) writeLocalDraft(date, { ...restored, cloudReady: true, syncedRevision: restored.revision });
        })
        .catch((err) => console.warn("[Narada] Cloud draft unavailable; local editing continues:", err));
    };
    restoreCloud();
    const onOnline = () => { canRestoreCloud = canRevalidateDraft(readLocalDraft(date)) || !cloudLoaded && canRestoreCloud; restoreCloud(); };
    window.addEventListener("online", onOnline);
    const onFocus = () => { canRestoreCloud = canRevalidateDraft(readLocalDraft(date)); restoreCloud(); };
    window.addEventListener("focus", onFocus);
    return () => { cancelled = true; clearTimeout(timer); unsub(); window.removeEventListener("online", onOnline); window.removeEventListener("focus", onFocus); };
  }, [dateStr, enabled, retryId]);

  const flush = useCallback(async () => {
    if (dateStr && enabled) await syncLocalDraft(dateStr);
  }, [dateStr, enabled]);

  const deleteDraft = useCallback(async (revision: string | undefined, uid: string | undefined) => {
    return dateStr ? retireLocalDraft(dateStr, revision, uid) : false;
  }, [dateStr]);
  return { deleteDraft, flush };
}
