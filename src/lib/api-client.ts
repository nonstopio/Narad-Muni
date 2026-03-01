import { auth } from "./firebase";

/**
 * Wrapper around fetch that injects the Firebase ID token as a Bearer token.
 * Use this instead of raw fetch() for all API calls.
 */
export async function authedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not authenticated");
  }

  const token = await user.getIdToken();

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(url, { ...options, headers });
}
