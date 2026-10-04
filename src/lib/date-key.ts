// "YYYY-MM-DD" day keys, shared by client and server. Keys are plain calendar
// days: all arithmetic is UTC on the key itself, so DST and the viewer's
// timezone never move a day.

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar day in YYYY-MM-DD form (rejects 2026-02-30). */
export function isDateKey(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = DATE_KEY.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toISOString().slice(0, 10) === s;
}

/** The `date` field POST /api/updates stores for a day key (UTC midnight). */
export function updateDateIso(key: string): string {
  return `${key}T00:00:00.000Z`;
}

/** The calendar day before `key`. */
export function prevDateKey(key: string): string {
  const d = new Date(updateDateIso(key));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
