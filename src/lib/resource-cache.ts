"use client";

import { useCallback, useEffect, useState } from "react";
import { auth } from "./firebase";
import { authedFetch } from "./api-client";

const memory = new Map<string, unknown>();
const requests = new Map<string, Promise<unknown>>();
let generation = 0;
function key(url: string) { return `narada.cache.${auth.currentUser?.uid ?? "signed-out"}.${url}`; }
export function cachedResource<T>(url: string): T | undefined {
  const k = key(url);
  if (memory.has(k)) return memory.get(k) as T;
  try {
    const stored = localStorage.getItem(k);
    if (stored) { const value = JSON.parse(stored); memory.set(k, value); return value; }
  } catch { /* Cache failure must not block the page. */ }
}
export function fetchResource<T>(url: string): Promise<T> {
  const k = key(url);
  const pending = requests.get(k);
  if (pending) return pending as Promise<T>;
  const startedGeneration = generation;
  const promise = authedFetch(url, { signal: AbortSignal.timeout(15000) })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const value = await res.json();
      if (generation !== startedGeneration || key(url) !== k) throw new Error("Discarded stale page response");
      if (key(url) === k) {
        memory.set(k, value);
        try { localStorage.setItem(k, JSON.stringify(value)); } catch { /* Optional cache. */ }
      }
      return value;
    }).finally(() => { if (requests.get(k) === promise) requests.delete(k); });
  requests.set(k, promise);
  return promise;
}
export function invalidateResources() {
  generation++;
  const prefix = `narada.cache.${auth.currentUser?.uid ?? "signed-out"}.`;
  for (const k of memory.keys()) if (k.startsWith(prefix)) memory.delete(k);
  for (const k of requests.keys()) if (k.startsWith(prefix)) requests.delete(k);
  try { for (const k of Object.keys(localStorage)) if (k.startsWith(prefix)) localStorage.removeItem(k); } catch {}
  window.dispatchEvent(new Event("narada:data-changed"));
}
/** Only call with endpoints that return no credentials. Show saved data while refreshing. */
export function useResource<T>(url: string) {
  const [data, setData] = useState<T | undefined>(() => cachedResource<T>(url));
  const [error, setError] = useState(false);
  const refresh = useCallback(() => {
    setError(false);
    return fetchResource<T>(url).then(setData).catch(() => setError(true));
  }, [url]);
  useEffect(() => {
    let cancelled = false;
    const load = () => { fetchResource<T>(url).then((value) => { if (!cancelled) { setData(value); setError(false); } }).catch(() => { if (!cancelled) setError(true); }); };
    load();
    window.addEventListener("online", load);
    window.addEventListener("focus", load);
    window.addEventListener("narada:data-changed", load);
    return () => { cancelled = true; window.removeEventListener("online", load); window.removeEventListener("focus", load); window.removeEventListener("narada:data-changed", load); };
  }, [url]);
  return { data, error, loading: data === undefined && !error, refresh };
}
