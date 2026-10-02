/**
 * Self-check for issue redaction. Run: npx tsx src/lib/redact.test.ts
 * GitHub issues are public, so a key that slips through here is leaked.
 */

import assert from "node:assert";
import { redact } from "./redact";

assert.match(redact("key sk-ant-api03-AbCdEf012345 here"), /\[redacted-key\]/, "Anthropic/OpenAI key");
assert.match(redact("gsk_ABCdef0123456789"), /\[redacted-key\]/, "Groq key");
assert.match(redact("AIzaSyA1234567890abcdefghijk"), /\[redacted-key\]/, "Gemini key");
assert.match(redact("xoxb-1234-5678-abcdefgh"), /\[redacted-key\]/, "Slack token");
assert.match(redact('"api-key": "9f8e7d6c5b4a3210"'), /\[redacted-key\]/, "Azure api-key header");
assert.match(redact("Authorization: Bearer abcdefgh12345678"), /\[redacted-key\]/, "bearer token");
assert.ok(!redact('"api-key": "9f8e7d6c5b4a3210"').includes("9f8e7d6c5b4a3210"));

assert.strictEqual(redact("https://acme.openai.azure.com/openai"), "https://<resource>.openai.azure.com/openai");
assert.strictEqual(
  redact("https://acme-prod.cognitiveservices.azure.com/"),
  "https://<resource>.cognitiveservices.azure.com/"
);
assert.strictEqual(redact("at f (/Users/ajay/Workspace/x.js:1:1)"), "at f (~/Workspace/x.js:1:1)");
assert.strictEqual(redact("at f (C:\\Users\\ajay\\x.js:1:1)"), "at f (~\\x.js:1:1)");

// Ordinary error text survives untouched.
assert.strictEqual(redact("Alas! 404 Resource not found"), "Alas! 404 Resource not found");

console.log("redact: all assertions passed");
