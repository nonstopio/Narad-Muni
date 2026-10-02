// Issues are public, and logs and error text can carry keys, Azure resource hosts and home paths.
// Same patterns as Morph's report.ts.
export function redact(text: string): string {
  return text
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|gsk_[A-Za-z0-9]{8,}|AIza[A-Za-z0-9_-]{20,}|xox[bapsr]-[A-Za-z0-9-]{8,})/g, "[redacted-key]")
    .replace(/((?:api[-_]?key|authorization|bearer|token)["'\s:=]+)[A-Za-z0-9._-]{8,}/gi, "$1[redacted-key]")
    .replace(/\b[A-Za-z0-9-]+\.(openai\.azure\.com|cognitiveservices\.azure\.com)/g, "<resource>.$1")
    .replace(/\/Users\/[^/\s"')]+/g, "~")
    .replace(/[A-Za-z]:\\Users\\[^\\\s"')]+/g, "~");
}
