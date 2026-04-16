import { adminDb } from "./firebase-admin";

export interface TimeSavedConstants {
  perPlatformSecs: number;
  perTaskSecs: number;
  perTimeEntrySecs: number;
}

export const DEFAULT_TIME_SAVED_CONSTANTS: TimeSavedConstants = {
  perPlatformSecs: 180,
  perTaskSecs: 60,
  perTimeEntrySecs: 120,
};

const CACHE_TTL_MS = 60_000;
let cache: { value: TimeSavedConstants; expiry: number } | null = null;

export async function getTimeSavedConstants(): Promise<TimeSavedConstants> {
  if (cache && cache.expiry > Date.now()) return cache.value;
  try {
    const doc = await adminDb.collection("config").doc("timeSavedConstants").get();
    const data = doc.data();
    const value: TimeSavedConstants = {
      perPlatformSecs: typeof data?.perPlatformSecs === "number" ? data.perPlatformSecs : DEFAULT_TIME_SAVED_CONSTANTS.perPlatformSecs,
      perTaskSecs: typeof data?.perTaskSecs === "number" ? data.perTaskSecs : DEFAULT_TIME_SAVED_CONSTANTS.perTaskSecs,
      perTimeEntrySecs: typeof data?.perTimeEntrySecs === "number" ? data.perTimeEntrySecs : DEFAULT_TIME_SAVED_CONSTANTS.perTimeEntrySecs,
    };
    cache = { value, expiry: Date.now() + CACHE_TTL_MS };
    return value;
  } catch {
    return DEFAULT_TIME_SAVED_CONSTANTS;
  }
}

export function invalidateTimeSavedCache(): void {
  cache = null;
}

export interface TimeSavedInput {
  platformsSucceeded: number;
  taskCount: number;
  timeEntryCount: number;
  toolTimeSecs: number;
}

export function estimateTimeSavedSecs(input: TimeSavedInput, constants: TimeSavedConstants): number {
  const saved =
    input.platformsSucceeded * constants.perPlatformSecs +
    input.taskCount * constants.perTaskSecs +
    input.timeEntryCount * constants.perTimeEntrySecs -
    input.toolTimeSecs;
  return Math.max(0, Math.round(saved));
}
