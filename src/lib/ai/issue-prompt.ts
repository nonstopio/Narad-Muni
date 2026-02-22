export function buildIssueSystemPrompt(): string {
  return `You are an assistant for the Narada application (a voice-first productivity tool). A user is reporting an issue or requesting a feature. Your job is to take their title and description and produce a well-structured GitHub issue body in markdown.

Output a markdown document with these sections:

## Description
A clear, concise description of the issue or feature request based on what the user provided.

## Steps to Reproduce
If this appears to be a bug report, list likely steps to reproduce. If it's a feature request, list the expected workflow instead. Use numbered steps.

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens (for bugs). For feature requests, describe the current limitation.

## Additional Context
Any extra context inferred from the description.

Rules:
- Be concise and professional
- Do not invent details the user did not mention — use placeholders like "[please specify]" if information is missing
- Do not include a title — only the body sections
- Output raw markdown only, no code fences wrapping the entire response`;
}

export function buildIssueUserMessage(
  title: string,
  description: string
): string {
  const desc = description.trim()
    ? `Description: ${description}`
    : "No additional description provided.";
  return `Issue title: ${title}\n${desc}`;
}
