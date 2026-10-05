/**
 * Self-check for the AI settings write/response. Run:
 *   npx tsx src/lib/ai-settings.test.ts
 */

import assert from "node:assert";
import { FieldValue } from "firebase-admin/firestore";
import { MASKED, buildSettingsResponse, buildSettingsUpdate } from "./ai-settings";

const purged = (u: Record<string, unknown>) =>
  (u.deepgramApiKey as FieldValue).isEqual(FieldValue.delete());

// Every save purges the stored Deepgram key.
assert.ok(purged(buildSettingsUpdate({})));

// A stray Deepgram key in the body is never written as a string.
assert.ok(purged(buildSettingsUpdate({ deepgramApiKey: "abc" })));

// removeKeys nulls only removable fields.
const removed = buildSettingsUpdate({ removeKeys: ["deepgramApiKey", "geminiApiKey", "bogus"] });
assert.strictEqual(removed.geminiApiKey, null);
assert.ok(!("bogus" in removed));
assert.ok(purged(removed));

// Masked values are echoes of the stored key, not new keys.
const keys = buildSettingsUpdate({ geminiApiKey: `abcd${MASKED}ijkl`, claudeApiKey: "sk-real" });
assert.ok(!("geminiApiKey" in keys));
assert.strictEqual(keys.claudeApiKey, "sk-real");

// The response never mentions Deepgram and masks real keys.
const res = buildSettingsResponse({ deepgramApiKey: "secret", geminiApiKey: "abcdefghijkl" } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
assert.ok(!Object.keys(res).some((k) => k.toLowerCase().includes("deepgram")));
assert.strictEqual(res.geminiApiKey, "abcd••••••••ijkl");
assert.strictEqual(res.hasGeminiKey, true);

// No stored settings → defaults.
assert.strictEqual(buildSettingsResponse(undefined).aiProvider, "local-claude");

console.log("ai-settings: all assertions passed");
