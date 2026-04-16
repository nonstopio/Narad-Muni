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
  | "recording_discarded"
  | "transcription_start"
  | "transcription_complete"
  | "ai_processing_start"
  | "ai_processing_complete"
  | "publish_start"
  | "publish_complete"
  | "publish_retry"
  | "processing_error"
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

/**
 * Classify a raw error into a short stable reason string for analytics.
 * Keeps cardinality low so GA4 can group them.
 */
export function classifyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const m = message.toLowerCase();
  if (m.includes("timed out") || m.includes("timeout")) return "timeout";
  if (m.includes("401") || m.includes("403") || m.includes("unauthorized") || m.includes("forbidden")) return "auth";
  if (m.includes("429") || m.includes("rate")) return "rate_limit";
  if (m.includes("network") || m.includes("fetch failed") || m.includes("econnrefused")) return "network";
  if (m.includes("json") || m.includes("invalid") || m.includes("parse")) return "invalid_response";
  if (m.includes("api key") || m.includes("not configured")) return "not_configured";
  return "other";
}
