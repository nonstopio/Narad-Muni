import { prevDateKey } from "./date-key";

/** Day keys of updates. Their `date` is UTC midnight, so the key is its date part. */
export function updateKeysOf(updates: { date: string }[]): Set<string> {
  return new Set(updates.map((u) => u.date.split("T")[0]));
}

/**
 * Consecutive days with an update, walking back from today. Leave days are
 * stepped over: they neither count nor break the run. Any other day without an
 * update (weekends included) ends it, and an empty today means 0.
 */
export function computeStreak(updateKeys: Set<string>, leaveKeys: Set<string>, todayKey: string): number {
  let s = 0;
  for (let key = todayKey; ; key = prevDateKey(key)) {
    if (updateKeys.has(key)) s++;
    else if (!leaveKeys.has(key)) return s;
  }
}
