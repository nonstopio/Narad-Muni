// Worklog comments are multi-line now (a textarea): ADF wants each line break as a
// hardBreak node, not a "\n" inside a text node.
export function buildAdfComment(text: string) {
  const content = text.split(/\r?\n/).flatMap((line, i) => [
    ...(i > 0 ? [{ type: "hardBreak" }] : []),
    ...(line ? [{ type: "text", text: line }] : []),
  ]);
  return {
    type: "doc",
    version: 1,
    // An empty comment keeps the single empty text node it always sent.
    content: [{ type: "paragraph", content: content.length ? content : [{ type: "text", text }] }],
  };
}
