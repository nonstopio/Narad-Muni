"use client";

import { type FirebasePerformance, type PerformanceTrace, trace as firebaseTrace } from "firebase/performance";
import { initPerformance } from "./firebase";

type NaradaTrace =
  | "narada_transcribe"
  | "narada_ai_parse"
  | "narada_publish"
  | "narada_full_update_flow";

let perfInstance: FirebasePerformance | null = null;
let perfPromise: Promise<FirebasePerformance | null> | null = null;

function getPerf(): Promise<FirebasePerformance | null> {
  if (perfInstance) return Promise.resolve(perfInstance);
  if (!perfPromise) {
    perfPromise = initPerformance().then((p) => {
      perfInstance = p;
      return p;
    });
  }
  return perfPromise;
}

/**
 * Start a custom trace. SSR-safe, never throws.
 */
export async function startTrace(name: NaradaTrace): Promise<PerformanceTrace | null> {
  try {
    if (typeof window === "undefined") return null;
    const perf = await getPerf();
    if (!perf) return null;
    const t = firebaseTrace(perf, name);
    t.start();
    return t;
  } catch {
    return null;
  }
}

/**
 * Stop a trace. Accepts null gracefully, never throws.
 */
export function stopTrace(t: PerformanceTrace | null): void {
  try {
    t?.stop();
  } catch {
    // Never throw from performance tracing
  }
}

/**
 * Wrap an async function in a trace. Tracing errors are swallowed; function errors propagate.
 */
export async function traceAsync<T>(name: NaradaTrace, fn: () => Promise<T>): Promise<T> {
  const t = await startTrace(name).catch(() => null);
  try {
    const result = await fn();
    stopTrace(t);
    return result;
  } catch (error) {
    stopTrace(t);
    throw error;
  }
}
