"use client";

import { type Analytics, logEvent as firebaseLogEvent } from "firebase/analytics";
import { initAnalytics } from "./firebase";

type NaradaEvent =
  | "session_start_narada"
  | "sign_out"
  | "page_view_home"
  | "page_view_update"
  | "page_view_history"
  | "page_view_settings"
  | "recording_start"
  | "recording_stop"
  | "transcription_start"
  | "ai_processing_start"
  | "ai_processing_complete"
  | "publish_start"
  | "publish_complete"
  | "publish_retry"
  | "update_delete"
  | "settings_save"
  | "ai_provider_change"
  | "draft_save";

let analyticsInstance: Analytics | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;

function getAnalytics(): Promise<Analytics | null> {
  if (analyticsInstance) return Promise.resolve(analyticsInstance);
  if (!analyticsPromise) {
    analyticsPromise = initAnalytics().then((a) => {
      analyticsInstance = a;
      return a;
    });
  }
  return analyticsPromise;
}

/**
 * Fire-and-forget event tracking. SSR-safe, never throws.
 */
export function trackEvent(event: NaradaEvent, params?: Record<string, string | number | boolean>) {
  try {
    if (typeof window === "undefined") return;
    getAnalytics().then((analytics) => {
      if (analytics) {
        firebaseLogEvent(analytics, event, params);
      }
    }).catch(() => {});
  } catch {
    // Never throw from analytics
  }
}
