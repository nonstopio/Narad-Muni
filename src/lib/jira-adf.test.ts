/**
 * Self-check for worklog comments. Run: npx tsx src/lib/jira-adf.test.ts
 * Line breaks typed in the comment textarea must reach Jira as hardBreak nodes.
 */

import assert from "node:assert";
import { buildAdfComment } from "./jira-adf";

const para = (text: string) => buildAdfComment(text).content[0].content;

assert.deepStrictEqual(para("Fixed the guard"), [{ type: "text", text: "Fixed the guard" }], "one line, one text node");
assert.deepStrictEqual(
  para("Fixed the guard\r\nAdded tests"),
  [{ type: "text", text: "Fixed the guard" }, { type: "hardBreak" }, { type: "text", text: "Added tests" }],
  "a line break becomes a hardBreak"
);
assert.deepStrictEqual(
  para("a\n\nb"),
  [{ type: "text", text: "a" }, { type: "hardBreak" }, { type: "hardBreak" }, { type: "text", text: "b" }],
  "blank lines keep their breaks but never emit an empty text node"
);
assert.deepStrictEqual(para(""), [{ type: "text", text: "" }], "empty comment unchanged");
assert.ok(JSON.stringify(buildAdfComment("x\ny")).indexOf("\\n") === -1, "no raw newline reaches Jira");

console.log("jira-adf: all assertions passed");
