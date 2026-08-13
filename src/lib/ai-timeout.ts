/**
 * Single source of truth for how long we wait on the oracle.
 * Used by the client fetch wrapper and by every server-side AI provider.
 */
export const DEFAULT_AI_TIMEOUT_MS = 120_000;
export const MIN_AI_TIMEOUT_MS = 15_000;
export const MAX_AI_TIMEOUT_MS = 600_000;

/** Coerce a stored/user-supplied value into a sane timeout in ms. */
export function resolveAiTimeout(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_AI_TIMEOUT_MS;
  return Math.min(MAX_AI_TIMEOUT_MS, Math.max(MIN_AI_TIMEOUT_MS, Math.round(n)));
}
