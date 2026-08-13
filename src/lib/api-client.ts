import { auth } from "./firebase";
import { DEFAULT_AI_TIMEOUT_MS, resolveAiTimeout } from "./ai-timeout";

const TIMEOUT_STORAGE_KEY = "narada.aiTimeoutMs";

/** Mirror the user's configured timeout locally so authedFetch can read it synchronously. */
export function cacheRequestTimeout(ms: number): void {
  try {
    localStorage.setItem(TIMEOUT_STORAGE_KEY, String(resolveAiTimeout(ms)));
  } catch {
    // localStorage unavailable — fall back to the default
  }
}

function requestTimeoutMs(): number {
  try {
    return resolveAiTimeout(localStorage.getItem(TIMEOUT_STORAGE_KEY));
  } catch {
    return DEFAULT_AI_TIMEOUT_MS;
  }
}

/**
 * Wrapper around fetch that injects the Firebase ID token as a Bearer token.
 * Times out after the configured oracle patience (default 2 min) — callers can
 * override via their own signal.
 */
export async function authedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const user = auth.currentUser;
  if (!user) {
    console.error("[Narada] authedFetch: no authenticated user for", url);
    throw new Error("Not authenticated");
  }

  let token: string;
  try {
    token = await user.getIdToken();
  } catch (err) {
    console.error("[Narada] authedFetch: token refresh failed for", url, err);
    throw err;
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  // Add timeout if caller didn't provide their own signal
  const timeoutMs = requestTimeoutMs();
  let controller: AbortController | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (!options.signal) {
    controller = new AbortController();
    timeoutId = setTimeout(() => controller!.abort(), timeoutMs);
  }

  try {
    return await fetch(url, {
      ...options,
      headers,
      signal: options.signal ?? controller?.signal,
    });
  } catch (err) {
    if (controller?.signal.aborted) {
      throw new Error(`Request to ${url} timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    console.error("[Narada] authedFetch: network error for", url, err);
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
