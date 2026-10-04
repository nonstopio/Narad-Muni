const TICKET_REGEX = /\b([A-Z][A-Z0-9_]+-\d+)\b/g;

/** All distinct ticket IDs (PROJ-123) in `text`, in order of appearance. */
export function findTickets(text: string): string[] {
  return [...new Set(text.match(TICKET_REGEX) ?? [])];
}

export function linkifyTickets(
  text: string,
  baseUrl: string,
  format: "slack" | "teams"
): string {
  if (!baseUrl?.trim()) return text;
  const base = baseUrl.replace(/\/+$/, "");
  let count = 0;
  const result = text.replace(TICKET_REGEX, (match) => {
    count++;
    const url = `${base}/browse/${match}`;
    return format === "slack" ? `<${url}|${match}>` : `[${match}](${url})`;
  });
  if (count > 0) {
    console.log(`[Narada] Linkified ${count} ticket(s) for ${format}`);
  }
  return result;
}
