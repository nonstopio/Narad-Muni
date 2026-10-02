export function seekAid(title: string, detail?: string) {
  const context = [
    `Page: ${window.location.pathname}${window.location.search}`,
    `Time: ${new Date().toISOString()}`,
    `User agent: ${navigator.userAgent}`,
  ].join("\n");
  try {
    sessionStorage.setItem(
      "narada-error-context",
      JSON.stringify({
        title,
        description: detail ? `${detail}\n\n${context}` : context,
      })
    );
  } catch {
    // sessionStorage may be unavailable
  }
  window.location.href = "/report";
}
