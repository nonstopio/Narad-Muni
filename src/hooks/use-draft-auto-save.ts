"use client";

import { useEffect, useRef, useCallback } from "react";
import { useUpdateStore } from "@/stores/update-store";
import { useToastStore } from "@/components/ui/toast";
import { authedFetch } from "@/lib/api-client";
import { trackEvent } from "@/lib/analytics";
import { shouldSave } from "./draft-save-rule";
import type { DraftSource } from "@/types";

const DEBOUNCE_MS = 1500;

export function useDraftAutoSave(dateStr: string | null, enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  const lastSourceRef = useRef<DraftSource>("manual");
  // False until this date's draft has loaded; nothing is saved before that.
  const loadedRef = useRef(false);
  const pendingRef = useRef<Promise<void> | null>(null);
  const enabledRef = useRef(enabled);
  const dateRef = useRef(dateStr);
  const saveErrorShownRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
    dateRef.current = dateStr;
  });

  // The save decision for the store's current text and source.
  const due = useCallback(() => {
    const { rawTranscript, draftSource } = useUpdateStore.getState();
    return shouldSave({
      loaded: loadedRef.current,
      text: rawTranscript,
      lastSaved: lastSavedRef.current,
      source: draftSource,
      lastSource: lastSourceRef.current,
    });
  }, []);

  const save = useCallback((date: string, keepalive = false) => {
    const { rawTranscript: text, draftSource: source } = useUpdateStore.getState();
    lastSavedRef.current = text;
    lastSourceRef.current = source;
    trackEvent("draft_save");
    const request = authedFetch("/api/drafts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, rawTranscript: text, source }),
      keepalive,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        saveErrorShownRef.current = false;
      })
      .catch((err) => {
        console.error("[Narada] Failed to save draft:", err);
        if (!saveErrorShownRef.current) {
          saveErrorShownRef.current = true;
          useToastStore.getState().addToast("Alas! Your draft could not be saved", "error");
        }
      });
    pendingRef.current = request;
    return request;
  }, []);

  // Load the draft for this date
  useEffect(() => {
    loadedRef.current = false;
    lastSavedRef.current = "";
    lastSourceRef.current = "manual";
    if (!enabled || !dateStr) return;

    let cancelled = false;

    authedFetch(`/api/drafts?date=${dateStr}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const saved: string = data.draft?.rawTranscript ?? "";
        const savedSource: DraftSource = data.draft?.source === "projects" ? "projects" : "manual";
        lastSavedRef.current = saved;
        lastSourceRef.current = savedSource;
        loadedRef.current = true;
        // Only restore if the textarea is still empty (resetForNewUpdate already ran)
        if (saved && !useUpdateStore.getState().rawTranscript.trim()) {
          useUpdateStore.setState({ rawTranscript: saved, draftSource: savedSource });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        loadedRef.current = true;
        console.error("[Narada] Failed to load draft:", err);
        useToastStore.getState().addToast("Alas! Could not retrieve your saved draft", "error");
      });

    return () => {
      cancelled = true;
    };
  }, [dateStr, enabled]);

  // Subscribe to rawTranscript changes and debounce-save
  useEffect(() => {
    if (!enabled || !dateStr) return;

    let prev = useUpdateStore.getState();

    const unsub = useUpdateStore.subscribe((state) => {
      if (state.rawTranscript === prev.rawTranscript && state.draftSource === prev.draftSource) return;
      prev = state;

      if (!enabledRef.current || !dateRef.current) return;
      if (!due()) return;

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!enabledRef.current || !dateRef.current) return;
        if (due()) save(dateRef.current);
      }, DEBOUNCE_MS);
    });

    return () => {
      unsub();
      // Flush pending save on unmount or date change (dateRef still holds the old date here)
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;

        if (dateRef.current && due()) save(dateRef.current, true);
      }
    };
  }, [dateStr, enabled, save, due]);

  /** Send any debounced change now and wait until the last save has landed. */
  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      if (dateRef.current && due()) save(dateRef.current);
    }
    await pendingRef.current;
  }, [save, due]);

  const deleteDraft = useCallback(async () => {
    if (!dateStr) return;
    lastSavedRef.current = "";
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    try {
      await authedFetch(`/api/drafts?date=${dateStr}`, { method: "DELETE" });
    } catch (err) {
      console.error("[Narada] Failed to delete draft:", err);
    }
  }, [dateStr]);

  return { deleteDraft, flush };
}
