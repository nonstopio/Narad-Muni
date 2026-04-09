import { auth } from "./firebase";

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Wrapper around fetch that injects the Firebase ID token as a Bearer token.
 * Includes a 30s default timeout — callers can override via their own signal.
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
  let controller: AbortController | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (!options.signal) {
    controller = new AbortController();
    timeoutId = setTimeout(() => controller!.abort(), DEFAULT_TIMEOUT_MS);
  }

  try {
    return await fetch(url, {
      ...options,
      headers,
      signal: options.signal ?? controller?.signal,
    });
  } catch (err) {
    if (controller?.signal.aborted) {
      throw new Error(`Request to ${url} timed out after ${DEFAULT_TIMEOUT_MS / 1000}s`);
    }
    console.error("[Narada] authedFetch: network error for", url, err);
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
