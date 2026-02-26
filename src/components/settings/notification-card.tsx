"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { useToastStore } from "@/components/ui/toast";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function NotificationCard() {
  const [isElectron, setIsElectron] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (!window.narada?.isElectron) {
      setIsElectron(false);
      setLoading(false);
      return;
    }
    setIsElectron(true);

    fetch("/api/settings/notifications")
      .then((res) => res.json())
      .then((data) => {
        setEnabled(data.notificationsEnabled);
        setHour(data.notificationHour);
        setMinute(data.notificationMinute);
        setDays(
          data.notificationDays
            .split(",")
            .filter(Boolean)
            .map((d: string) => parseInt(d.trim(), 10))
        );
      })
      .catch((err) => {
        console.error("[NotificationCard] Failed to load notification settings:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !isElectron) return null;

  const toggleDay = (day: number) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationsEnabled: enabled,
          notificationHour: hour,
          notificationMinute: minute,
          notificationDays: days.join(","),
        }),
      });
      if (!res.ok) throw new Error("Failed");

      // Pass config directly to Electron to avoid cross-process DB read issues
      await window.narada?.reloadNotificationSchedule({
        notificationsEnabled: enabled,
        notificationHour: hour,
        notificationMinute: minute,
        notificationDays: days.join(","),
      });

      addToast(
        "Narayan Narayan! I shall ring the sacred bell at the appointed hour",
        "success"
      );
    } catch {
      addToast("Alas! The bell could not be configured", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await window.narada?.testNotification();
      addToast("Narayan Narayan! A test bell has been rung — check your notifications", "success");
    } catch (err) {
      console.error("[NotificationCard] Test notification failed:", err);
      addToast("Alas! The test bell could not be rung", "error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="text-base font-semibold mb-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-base">
          <Bell className="w-4 h-4 text-narada-amber" />
        </div>
        <span>Sacred Bell</span>
      </div>

      <p className="text-xs text-narada-text-secondary mb-4">
        I shall remind you when it is time to chronicle your deeds.
      </p>

      {/* Toggle */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-sm text-narada-text">Awaken the Sacred Bell</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
            enabled ? "bg-narada-amber" : "bg-white/[0.1]"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-200 ease-in-out ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <>
          {/* Time picker */}
          <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
            Reminder Time
          </label>
          <div className="flex gap-2 mb-5">
            <select
              value={hour}
              onChange={(e) => setHour(parseInt(e.target.value, 10))}
              className="glass-input w-24 text-center text-sm"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, "0")}
                </option>
              ))}
            </select>
            <span className="text-narada-text-secondary self-center text-lg font-semibold">:</span>
            <select
              value={minute}
              onChange={(e) => setMinute(parseInt(e.target.value, 10))}
              className="glass-input w-24 text-center text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>

          {/* Day selector */}
          <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
            Reminder Days
          </label>
          <div className="flex gap-2 mb-4">
            {DAY_LABELS.map((label, idx) => {
              const isSelected = days.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  className={`w-9 h-9 rounded-full text-xs font-semibold transition-all duration-200 ${
                    isSelected
                      ? "bg-narada-amber text-white shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                      : "bg-white/[0.05] text-narada-text-secondary border border-white/[0.06] hover:border-narada-amber/40 hover:text-narada-text"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
        <button
          onClick={handleTest}
          disabled={testing || saving}
          className="h-8 px-3 rounded-xl border border-white/[0.12] text-narada-text-secondary text-xs font-semibold hover:border-narada-amber/50 hover:text-narada-text hover:bg-narada-amber/[0.05] transition-all duration-300 disabled:opacity-50"
        >
          {testing ? "Ringing..." : "Test Bell"}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || testing}
          className="h-8 px-3 rounded-xl bg-narada-primary text-white text-xs font-semibold shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:bg-blue-600 transition-all duration-300 disabled:opacity-50"
        >
          {saving ? "Inscribing..." : "Inscribe"}
        </button>
      </div>
    </div>
  );
}
