const TICKET_REGEX = /\b([A-Z][A-Z0-9_]+-\d+)\b/g;

export function linkifyTickets(
  text: string,
  baseUrl: string,
  format: "slack" | "teams"
): string {
  const base = baseUrl.replace(/\/+$/, "");
  return text.replace(TICKET_REGEX, (match) => {
    const url = `${base}/browse/${match}`;
    return format === "slack" ? `<${url}|${match}>` : `[${match}](${url})`;
  });
}
