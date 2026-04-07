"use client";

import { useEffect, useRef, useCallback } from "react";
import { useUpdateStore } from "@/stores/update-store";
import { useToastStore } from "@/components/ui/toast";
import { authedFetch } from "@/lib/api-client";
import { trackEvent } from "@/lib/analytics";

const DEBOUNCE_MS = 1500;

export function useDraftAutoSave(dateStr: string | null, enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  const latestTextRef = useRef<string>("");
  const enabledRef = useRef(enabled);
  const dateRef = useRef(dateStr);
  const saveErrorShownRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
    dateRef.current = dateStr;
  });

  // Load draft on mount
  useEffect(() => {
    if (!enabled || !dateStr) return;

    let cancelled = false;

    authedFetch(`/api/drafts?date=${dateStr}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.draft?.rawTranscript) {
          const current = useUpdateStore.getState().rawTranscript;
          // Only restore if the textarea is still empty (resetForNewUpdate already ran)
          if (!current.trim()) {
            useUpdateStore.getState().setRawTranscript(data.draft.rawTranscript);
            lastSavedRef.current = data.draft.rawTranscript;
            latestTextRef.current = data.draft.rawTranscript;
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[Narada] Failed to load draft:", err);
          useToastStore.getState().addToast("Alas! Could not retrieve your saved draft", "error");
        }
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
      if (text === lastSavedRef.current) return;

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!enabledRef.current || !dateRef.current) return;

        const current = latestTextRef.current;
        if (current === lastSavedRef.current) return;

        lastSavedRef.current = current;
        trackEvent("draft_save");
        authedFetch("/api/drafts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dateRef.current, rawTranscript: current }),
        })
          .then(() => {
            saveErrorShownRef.current = false;
          })
          .catch((err) => {
            console.error("[Narada] Failed to save draft:", err);
            if (!saveErrorShownRef.current) {
              saveErrorShownRef.current = true;
              useToastStore.getState().addToast("Alas! Your draft could not be saved", "error");
            }
          });
      }, DEBOUNCE_MS);
    });

    return () => {
      unsub();
      // Flush pending save on unmount
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;

        const text = latestTextRef.current;
        if (text !== lastSavedRef.current && dateRef.current) {
          authedFetch("/api/drafts", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: dateRef.current, rawTranscript: text }),
            keepalive: true,
          }).catch(() => {});
        }
      }
    };
  }, [dateStr, enabled]);

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

  return { deleteDraft };
}
