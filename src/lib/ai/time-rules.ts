import type { ClaudeTimeEntry } from "@/types/claude";

export const DEFAULT_TARGET_SECS = 28800; // 8 hours
const UNIT_SECS = 1800; // 30-minute granularity and per-entry minimum

// "2026-10-06T10:00:00" is wall-clock with no zone; parse it as UTC so no conversion happens.
const toMs = (started: string) => Date.parse(started.slice(0, 19) + "Z");
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 19);

/** Split `total` units across weights (largest remainder), at least 1 unit each. */
function allocateUnits(weights: number[], total: number): number[] {
  const n = weights.length;
  if (total <= n) return weights.map(() => 1); // infeasible or exact: every entry gets the minimum
  const sum = weights.reduce((s, w) => s + w, 0);
  const quotas = weights.map((w) => (sum > 0 ? (w / sum) * total : total / n));
  const units = quotas.map((q) => Math.max(1, Math.floor(q)));
  let diff = total - units.reduce((s, u) => s + u, 0);
  // Short: top up the biggest remainders. Over (from the 1-unit floor): trim whoever sits most above quota.
  while (diff > 0) {
    const i = units.reduce((best, u, j) => (quotas[j] - u > quotas[best] - units[best] ? j : best), 0);
    units[i]++;
    diff--;
  }
  while (diff < 0) {
    let i = -1;
    units.forEach((u, j) => {
      if (u > 1 && (i < 0 || u - quotas[j] > units[i] - quotas[i])) i = j;
    });
    units[i]--;
    diff++;
  }
  return units;
}

/**
 * Round non-repeat entries to 30-min steps (at least 30 min) and, if the day falls
 * short of `targetSecs`, scale them up to meet it. Longer days are kept as they are.
 * Then lay them back-to-back from the first one's start.
 * Repeat entries are never touched.
 */
export function enforceTimeRules(allEntries: ClaudeTimeEntry[], targetSecs: number): ClaudeTimeEntry[] {
  const repeatEntries = allEntries.filter((e) => e.isRepeat);
  const nonRepeatEntries = allEntries.filter((e) => !e.isRepeat);

  if (nonRepeatEntries.length === 0) return allEntries;

  const repeatTotal = repeatEntries.reduce((sum, e) => sum + e.timeSpentSecs, 0);
  const targetUnits = Math.round(Math.max(0, targetSecs - repeatTotal) / UNIT_SECS);
  const weights = nonRepeatEntries.map((e) => Math.max(0, e.timeSpentSecs || 0));
  // The chosen hours are a floor: a longer day stays as described, a shorter one grows to fit.
  const asIs = weights.map((w) => Math.max(1, Math.round(w / UNIT_SECS)));
  const units = asIs.reduce((s, u) => s + u, 0) >= targetUnits ? asIs : allocateUnits(weights, targetUnits);

  let cursor = toMs(nonRepeatEntries[0].started);
  const adjusted = nonRepeatEntries.map((e, i) => {
    const timeSpentSecs = units[i] * UNIT_SECS;
    // An unparseable start is left as the AI wrote it.
    if (Number.isNaN(cursor)) return { ...e, timeSpentSecs };
    const started = fromMs(cursor);
    cursor += timeSpentSecs * 1000;
    return { ...e, timeSpentSecs, started };
  });

  return [...repeatEntries, ...adjusted].sort((a, b) =>
    a.started.localeCompare(b.started)
  );
}
