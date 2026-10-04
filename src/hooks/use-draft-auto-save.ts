"use client";

import { useEffect, useRef, useCallback } from "react";
import { useUpdateStore } from "@/stores/update-store";
import { useToastStore } from "@/components/ui/toast";
import { authedFetch } from "@/lib/api-client";
import { trackEvent } from "@/lib/analytics";
import { shouldSave } from "./draft-save-rule";

const DEBOUNCE_MS = 1500;

export function useDraftAutoSave(dateStr: string | null, enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  const latestTextRef = useRef<string>("");
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

  const save = useCallback((text: string, date: string, keepalive = false) => {
    lastSavedRef.current = text;
    trackEvent("draft_save");
    const request = authedFetch("/api/drafts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, rawTranscript: text }),
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
    if (!enabled || !dateStr) return;

    let cancelled = false;

    authedFetch(`/api/drafts?date=${dateStr}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const saved: string = data.draft?.rawTranscript ?? "";
        lastSavedRef.current = saved;
        loadedRef.current = true;
        // Only restore if the textarea is still empty (resetForNewUpdate already ran)
        if (saved && !useUpdateStore.getState().rawTranscript.trim()) {
          latestTextRef.current = saved;
          useUpdateStore.getState().setRawTranscript(saved);
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

    let prevTranscript = useUpdateStore.getState().rawTranscript;

    const unsub = useUpdateStore.subscribe((state) => {
      const text = state.rawTranscript;
      if (text === prevTranscript) return;
      prevTranscript = text;
      latestTextRef.current = text;

      if (!enabledRef.current || !dateRef.current) return;
      if (!shouldSave({ loaded: loadedRef.current, text, lastSaved: lastSavedRef.current })) return;

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!enabledRef.current || !dateRef.current) return;

        const current = latestTextRef.current;
        if (!shouldSave({ loaded: loadedRef.current, text: current, lastSaved: lastSavedRef.current })) return;
        save(current, dateRef.current);
      }, DEBOUNCE_MS);
    });

    return () => {
      unsub();
      // Flush pending save on unmount or date change (dateRef still holds the old date here)
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;

        const text = latestTextRef.current;
        if (dateRef.current && shouldSave({ loaded: loadedRef.current, text, lastSaved: lastSavedRef.current })) {
          save(text, dateRef.current, true);
        }
      }
    };
  }, [dateStr, enabled, save]);

  /** Send any debounced change now and wait until the last save has landed. */
  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const text = latestTextRef.current;
      if (dateRef.current && shouldSave({ loaded: loadedRef.current, text, lastSaved: lastSavedRef.current })) {
        save(text, dateRef.current);
      }
    }
    await pendingRef.current;
  }, [save]);

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
