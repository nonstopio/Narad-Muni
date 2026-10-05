/**
 * Self-check for the HTTPS → Chromium fetch routing. Run: npx tsx electron/net-fetch.test.ts
 * A regression here sends AI, Slack and Jira calls back through Node, where TLS-intercepting
 * networks break them all.
 */

import assert from "node:assert";
import { routeHttpsVia } from "./net-fetch";

type Call = { via: string; input: unknown; init?: RequestInit };
const calls: Call[] = [];
const stub = (via: string) =>
  (async (input: unknown, init?: RequestInit) => {
    calls.push({ via, input, init });
    return new Response("ok");
  }) as typeof fetch;
const f = routeHttpsVia(stub("node"), stub("net"));

(async () => {
  // HTTPS goes to Chromium, HTTP (Next's localhost) stays on Node.
  await f("https://x.cognitiveservices.azure.com/openai");
  await f("http://localhost:3947/api");
  assert.deepStrictEqual(calls.map((c) => c.via), ["net", "node"]);

  // URL objects become strings for net.fetch, and route by protocol too.
  calls.length = 0;
  await f(new URL("https://slack.com/api/api.test"));
  await f(new URL("http://localhost/x"));
  assert.strictEqual(calls[0].via, "net");
  assert.strictEqual(calls[0].input, "https://slack.com/api/api.test");
  assert.strictEqual(calls[1].via, "node");

  // Request objects route by their url and pass through untouched.
  calls.length = 0;
  const req = new Request("https://api.anthropic.com/v1/messages", { method: "POST", body: "a" });
  await f(req);
  assert.strictEqual(calls[0].via, "net");
  assert.strictEqual(calls[0].input, req);

  // Content-Length is dropped (any case, any headers shape); everything else survives.
  for (const headers of [
    { "Content-Length": "3", "api-key": "k" },
    [["content-length", "3"], ["api-key", "k"]] as [string, string][],
    new Headers({ "CONTENT-LENGTH": "3", "api-key": "k" }),
  ]) {
    calls.length = 0;
    await f("https://x.test", { method: "POST", headers, body: "abc" });
    const sent = new Headers(calls[0].init!.headers);
    assert.strictEqual(sent.has("content-length"), false);
    assert.strictEqual(sent.get("api-key"), "k");
    assert.strictEqual(calls[0].init!.body, "abc");
    assert.strictEqual(calls[0].init!.method, "POST");
  }

  // Node keeps its headers as given, and no-header calls don't grow a headers field.
  calls.length = 0;
  await f("http://localhost/x", { headers: { "Content-Length": "3" } });
  await f("https://x.test", { method: "GET" });
  assert.strictEqual(new Headers(calls[0].init!.headers).get("content-length"), "3");
  assert.strictEqual(calls[1].init!.headers, undefined);

  console.log("net-fetch: all assertions passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
