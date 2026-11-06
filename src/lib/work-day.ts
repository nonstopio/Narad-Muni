// The user's work day: when it starts and how many hours it usually holds.
// Stored on `users/{uid}/settings/app` as `workDayStart` ("HH:MM") and `defaultWorkHours`.

export const DEFAULT_WORK_DAY_START = "10:00";
export const DEFAULT_WORK_HOURS = 8;

export interface WorkDaySettings {
  workDayStart: string;
  defaultWorkHours: number;
}

/** "HH:MM", 24-hour, on a half-hour step (Jira entries are half-hour units). */
export const isWorkDayStart = (v: unknown): v is string =>
  typeof v === "string" && /^([01]\d|2[0-3]):(00|30)$/.test(v);

/** 0.5–24 hours in half-hour steps. */
export const isWorkHours = (v: unknown): v is number =>
  typeof v === "number" && v >= 0.5 && v <= 24 && Number.isInteger(v * 2);

/** Reads stored settings, falling back to the defaults for anything missing or malformed. */
export function workDayFrom(settings: Record<string, unknown> | undefined | null): WorkDaySettings {
  return {
    workDayStart: isWorkDayStart(settings?.workDayStart) ? settings.workDayStart : DEFAULT_WORK_DAY_START,
    defaultWorkHours: isWorkHours(settings?.defaultWorkHours) ? settings.defaultWorkHours : DEFAULT_WORK_HOURS,
  };
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const fromMinutes = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/**
 * When the day's own entries begin: the work-day start, pushed later past any fixed
 * entry that runs beyond it, but never so late that the remaining time crosses midnight.
 */
export function firstEntryStart(
  dayStart: string,
  repeats: { startTime: string; hours: number }[],
  remainingSecs: number
): string {
  const repeatEnd = repeats.reduce((latest, e) => {
    const start = toMinutes(e.startTime);
    return Number.isNaN(start) ? latest : Math.max(latest, start + e.hours * 60);
  }, toMinutes(dayStart));
  return fromMinutes(Math.round(Math.min(repeatEnd, Math.max(0, 24 * 60 - remainingSecs / 60))));
}

/** "30 min" steps from 06:00 to 14:00 — the start choices offered in Settings. */
export const WORK_DAY_START_OPTIONS = Array.from({ length: 17 }, (_, i) => fromMinutes(6 * 60 + i * 30));

/** 13:30 → "1:30 PM". */
export function formatClock(hhmm: string): string {
  const mins = toMinutes(hhmm);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** 7.5 → "7.5h", 8 → "8h". */
export const formatHoursShort = (h: number) => `${Number.isInteger(h) ? h : Math.round(h * 10) / 10}h`;
