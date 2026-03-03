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

  try {
    return await fetch(url, { ...options, headers });
  } catch (err) {
    console.error("[Narada] authedFetch: network error for", url, err);
    throw err;
  }
}
