/**
 * Self-check for the draft autosave rule (F7). Run: npx tsx src/hooks/draft-save-rule.test.ts
 *
 * The hook used to PUT an empty draft for a newly opened date before that
 * date's draft had loaded, and the server deletes a draft on an empty PUT.
 */

import assert from "node:assert";
import { shouldSave } from "./draft-save-rule";

// F7: switching to date B resets the store to "" while lastSaved still holds
// date A's text. Before B's draft has loaded, that must not be saved.
assert.strictEqual(shouldSave({ loaded: false, text: "", lastSaved: "draft for A" }), false);
assert.strictEqual(shouldSave({ loaded: false, text: "typed early", lastSaved: "" }), false);

// After load, ordinary edits save.
assert.strictEqual(shouldSave({ loaded: true, text: "hello", lastSaved: "" }), true);
assert.strictEqual(shouldSave({ loaded: true, text: "hello!", lastSaved: "hello" }), true);

// Nothing changed → nothing to send.
assert.strictEqual(shouldSave({ loaded: true, text: "same", lastSaved: "same" }), false);
assert.strictEqual(shouldSave({ loaded: true, text: "", lastSaved: "" }), false);

// The user clearing a loaded draft is a real delete.
assert.strictEqual(shouldSave({ loaded: true, text: "", lastSaved: "old text" }), true);

// A source change alone (manual → projects) must be saved, so a reload restores it.
assert.strictEqual(shouldSave({ loaded: true, text: "same", lastSaved: "same", source: "projects", lastSource: "manual" }), true);
assert.strictEqual(shouldSave({ loaded: true, text: "same", lastSaved: "same", source: "projects", lastSource: "projects" }), false);
assert.strictEqual(shouldSave({ loaded: false, text: "same", lastSaved: "same", source: "projects", lastSource: "manual" }), false);

console.log("draft-save-rule: all assertions passed");
