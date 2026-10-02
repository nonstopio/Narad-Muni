/**
 * Self-check for the Azure OpenAI request shape. Run: npx tsx src/lib/ai/openai-provider.test.ts
 * Mirrors what Morph sends to the same resource: deployment in the URL, api-key header,
 * a current api-version, and no token cap.
 */

import assert from "node:assert";
import { AzureOpenAIProvider, DEFAULT_AZURE_API_VERSION } from "./openai-provider";

const sent: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  sent.push({
    url: String(input),
    headers: new Headers(init?.headers),
    body: JSON.parse(String(init?.body)),
  });
  const content = JSON.stringify({ tasks: [], blockers: [], timeEntries: [], tomorrowTasks: [] });
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch;

async function send(over: { endpoint?: string; deployment?: string; apiVersion?: string; apiKey?: string }) {
  sent.length = 0;
  const provider = new AzureOpenAIProvider({
    apiKey: " k3y ",
    endpoint: "https://r.openai.azure.com",
    deployment: "gpt-5-5-2",
    apiVersion: "",
    ...over,
  });
  await provider.parseTranscript("worked on the parser", "2026-10-02", []);
  assert.strictEqual(sent.length, 1, "exactly one request should be sent");
  return sent[0];
}

const CHAT = "https://r.openai.azure.com/openai/deployments/gpt-5-5-2/chat/completions?api-version=";

(async () => {
  const base = await send({});
  assert.strictEqual(base.url, `${CHAT}${DEFAULT_AZURE_API_VERSION}`, "empty version falls back to the default");
  assert.strictEqual(base.headers.get("api-key"), "k3y", "key is trimmed and sent as api-key");
  assert.ok(!("max_completion_tokens" in base.body), "no token cap: reasoning deployments spend it on hidden reasoning");
  assert.ok(!("max_tokens" in base.body), "no legacy token cap either");
  assert.deepStrictEqual(base.body.response_format, { type: "json_object" });

  // The old default was saved into configs verbatim, so it must not stick.
  assert.strictEqual((await send({ apiVersion: "2024-08-01-preview" })).url, `${CHAT}${DEFAULT_AZURE_API_VERSION}`);
  // An explicit override is honoured, trimmed.
  assert.strictEqual((await send({ apiVersion: " 2024-10-21 " })).url, `${CHAT}2024-10-21`);
  // Pasted values with stray whitespace and trailing slashes still route.
  assert.strictEqual(
    (await send({ endpoint: " https://r.openai.azure.com// ", deployment: " gpt-5-5-2 " })).url,
    `${CHAT}${DEFAULT_AZURE_API_VERSION}`
  );

  console.log("openai-provider: all assertions passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
