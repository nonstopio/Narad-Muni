"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { authedFetch } from "@/lib/api-client";
import { useToastStore } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { invalidateResources } from "@/lib/resource-cache";
import { useUpdateStore } from "@/stores/update-store";
import {
  DEFAULT_WORK_DAY_START,
  DEFAULT_WORK_HOURS,
  WORK_DAY_START_OPTIONS,
  formatClock,
  fromMinutes,
  isWorkHours,
  toMinutes,
} from "@/lib/work-day";

const HOUR_CHIPS = [6, 7, 8, 9, 10];

export function WorkDayCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [start, setStart] = useState(DEFAULT_WORK_DAY_START);
  const [hours, setHours] = useState(DEFAULT_WORK_HOURS);
  const [customHours, setCustomHours] = useState<string | null>(null);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    authedFetch("/api/settings/work-day")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data) => {
        setStart(data.workDayStart);
        setHours(data.defaultWorkHours);
      })
      .catch((err) => {
        console.error("[Narada] WorkDayCard load:", err);
        addToast("Alas! I could not recall your hours of devotion", "error");
      })
      .finally(() => setLoading(false));
  }, [addToast]);

  // A stored start outside the usual range still shows up as a choice.
  const startOptions = WORK_DAY_START_OPTIONS.includes(start)
    ? WORK_DAY_START_OPTIONS
    : [...WORK_DAY_START_OPTIONS, start].sort();
  const endsAt = fromMinutes((toMinutes(start) + Math.round(hours * 60)) % (24 * 60));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authedFetch("/api/settings/work-day", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workDayStart: start, defaultWorkHours: hours }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStart(data.workDayStart);
      setHours(data.defaultWorkHours);
      useUpdateStore.getState().setDefaultWorkedHours(data.defaultWorkHours);
      invalidateResources();
      addToast(`Narayan Narayan! Your chronicles shall begin at ${formatClock(data.workDayStart)}`, "success");
    } catch (err) {
      console.error("[Narada] WorkDayCard save:", err);
      addToast(err instanceof Error && err.message.startsWith("Alas") ? err.message : "Alas! Your hours would not take hold", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="text-base font-semibold mb-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-base">
          <Clock className="w-4 h-4 text-narada-primary" />
        </div>
        <span>Sacred Hours</span>
      </div>

      <p className="text-xs text-narada-text-secondary mb-5">
        Tell me when your day begins and how long it runs. I shall lay your Jira chronicles from that hour.
      </p>

      <div className={`transition-opacity duration-200 ${loading ? "opacity-40 pointer-events-none" : ""}`}>
        <div className="mb-5">
          <label htmlFor="work-day-start" className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
            Day begins at
          </label>
          <select
            id="work-day-start"
            className="glass-input bg-white/[0.02]"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          >
            {startOptions.map((t) => (
              <option key={t} value={t} className="bg-narada-surface">
                {formatClock(t)}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-5">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span id="default-hours-label" className="text-xs font-semibold text-narada-text-secondary uppercase tracking-wider">
              Usual hours of devotion
            </span>
            <span className="text-[11px] text-narada-text-muted">You can still change them each day</span>
          </div>
          <div role="group" aria-labelledby="default-hours-label" className="flex items-center gap-1.5">
            {HOUR_CHIPS.map((h) => {
              const active = customHours === null && hours === h;
              return (
                <button
                  key={h}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setCustomHours(null);
                    setHours(h);
                  }}
                  className={`flex-1 h-8 rounded-lg text-xs font-medium transition-all duration-200 ${
                    active
                      ? "bg-narada-primary border border-narada-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                      : "bg-white/[0.03] border border-white/[0.06] text-narada-text-secondary hover:bg-white/[0.06] hover:text-narada-text"
                  }`}
                >
                  {h}h
                </button>
              );
            })}
            <div className="relative w-[4.5rem] shrink-0">
              <input
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                placeholder="Other"
                aria-label="Custom usual hours"
                value={customHours ?? (HOUR_CHIPS.includes(hours) ? "" : String(hours))}
                onChange={(e) => {
                  setCustomHours(e.target.value);
                  const h = Number(e.target.value);
                  if (e.target.value && isWorkHours(h)) setHours(h);
                }}
                onBlur={() => {
                  const h = Number(customHours);
                  if (customHours && Number.isFinite(h)) setHours(Math.min(24, Math.max(0.5, Math.round(h * 2) / 2)));
                  setCustomHours(null);
                }}
                className={`w-full h-8 px-2 rounded-lg [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none text-xs text-center font-mono bg-white/[0.03] border text-narada-text placeholder:font-sans placeholder:text-narada-text-muted focus:outline-none focus:border-narada-primary transition-all duration-200 ${
                  customHours === null && !HOUR_CHIPS.includes(hours) ? "border-narada-primary" : "border-white/[0.06]"
                }`}
              />
              {(customHours || !HOUR_CHIPS.includes(hours)) && (
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-narada-text-muted">h</span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 mb-5 text-xs text-narada-text-secondary">
          A usual day runs <span className="font-mono text-narada-text">{formatClock(start)}</span> to{" "}
          <span className="font-mono text-narada-text">{formatClock(endsAt)}</span>. Recurring rituals that run past the start push your own work later.
        </div>

        <div className="flex justify-end pt-4 border-t border-white/[0.06]">
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || loading}>
            {saving ? "Inscribing..." : "Inscribe"}
          </Button>
        </div>
      </div>
    </div>
  );
}
