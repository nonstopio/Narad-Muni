/**
 * Corporate TLS interceptors install their root in the OS trust store, which Node's fetch never
 * reads, so every outbound call dies as "Connection error." / "unable to get local issuer
 * certificate". Chromium's net.fetch reads the OS store and proxy config (as Morph does), so
 * HTTPS goes through it; plain HTTP (Next's own localhost traffic) stays on Node.
 */
export function routeHttpsVia(nodeFetch: typeof fetch, netFetch: typeof fetch): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.startsWith("https:")) return nodeFetch(input, init);
    // Chromium rejects an explicit Content-Length (net::ERR_INVALID_ARGUMENT) and sets it itself.
    if (init?.headers) {
      const headers = new Headers(init.headers);
      headers.delete("content-length");
      init = { ...init, headers };
    }
    // net.fetch takes a string or Request, not a URL object.
    return netFetch(input instanceof URL ? url : input, init);
  }) as typeof fetch;
}
