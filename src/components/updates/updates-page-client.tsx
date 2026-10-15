"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StatsBar } from "./stats-bar";
import { Calendar } from "./calendar";
import { HistoryDetailModal } from "@/components/history/history-detail-modal";
import { useAppStore } from "@/stores/app-store";
import { useCalendar } from "@/hooks/use-calendar";
import { useToastStore } from "@/components/ui/toast";
import { cachedResource, fetchResource, invalidateResources } from "@/lib/resource-cache";
import { computeCombinedStatus } from "@/types";
import { monthStats } from "@/lib/month-stats";
import type { CombinedStatus, StatData, UpdateData } from "@/types";

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

interface Props {
  streak: number;
  monthUpdates: UpdateData[];
  monthLeaves: string[];
  monthHolidays: string[];
}

export function UpdatesPageClient({
  streak,
  monthUpdates: initialMonthUpdates,
  monthLeaves: initialMonthLeaves,
  monthHolidays: initialMonthHolidays,
}: Props) {
  const { currentMonth, monthTitle, calendarDays, prevMonth, nextMonth, goToToday } = useCalendar();
  const monthKey = formatMonth(currentMonth);
  const [initialMonthKey] = useState(monthKey);
  const [loaded, setLoaded] = useState<{ month: string; updates: UpdateData[]; leaves: string[]; holidays: string[] } | null>(null);
  const initial = monthKey === initialMonthKey ? { updates: initialMonthUpdates, leaves: initialMonthLeaves, holidays: initialMonthHolidays } : null;
  const cachedUpdates = cachedResource<{ updates: UpdateData[] }>(`/api/updates?month=${monthKey}`);
  const cachedLeaves = cachedResource<{ leaves: string[]; holidays: string[] }>(`/api/leaves?month=${monthKey}`);
  const cached = cachedUpdates && cachedLeaves ? { updates: cachedUpdates.updates, leaves: cachedLeaves.leaves, holidays: cachedLeaves.holidays } : null;
  const shown = initial ?? (loaded?.month === monthKey ? loaded : cached);
  const monthLoading = shown === null;
  const monthUpdates = useMemo(() => shown?.updates ?? [], [shown?.updates]);
  const leaveSet = useMemo(() => new Set(shown?.leaves ?? []), [shown?.leaves]);
  const holidaySet = useMemo(() => new Set(shown?.holidays ?? []), [shown?.holidays]);

  useEffect(() => {
    if (monthKey === initialMonthKey) return;
    let cancelled = false;
    Promise.all([
      fetchResource<{ updates: UpdateData[] }>(`/api/updates?month=${monthKey}`),
      fetchResource<{ leaves: string[]; holidays: string[] }>(`/api/leaves?month=${monthKey}`),
    ]).then(([updates, leaves]) => {
      if (!cancelled) setLoaded({ month: monthKey, updates: updates.updates || [], leaves: leaves.leaves || [], holidays: leaves.holidays || [] });
    }).catch((err) => {
      if (!cancelled) {
        console.error("[Narada] Month refresh failed:", err);
        useToastStore.getState().addToast("Alas! I could not refresh this month's chronicles.", "error");
        if (!cachedResource(`/api/updates?month=${monthKey}`)) setLoaded({ month: monthKey, updates: [], leaves: [], holidays: [] });
      }
    });
    return () => { cancelled = true; };
  }, [monthKey, initialMonthKey]);

  const updateStatusMap = useMemo(() => {
    const map = new Map<string, CombinedStatus>();
    for (const u of monthUpdates) {
      const key = u.date.split("T")[0];
      map.set(key, computeCombinedStatus(u.slackStatus, u.teamsStatus, u.jiraStatus));
    }
    return map;
  }, [monthUpdates]);
  const [selectedUpdate, setSelectedUpdate] = useState<UpdateData | null>(null);
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);
  const router = useRouter();

  // Build a lookup map: "YYYY-MM-DD" → UpdateData
  const updatesByDate = new Map<string, UpdateData>();
  for (const u of monthUpdates) {
    const key = u.date.split("T")[0];
    updatesByDate.set(key, u);
  }

  const { messages, timeReclaimed } = monthStats(monthUpdates);
  const stats: StatData[] = [
    {
      label: "Messages This Month",
      value: messages,
      icon: "\u{1F4CA}",
      color: "blue",
    },
    {
      label: "Devotion Streak",
      value: streak,
      icon: "\u{1F525}",
      color: "violet",
    },
    {
      label: "Time Reclaimed",
      value: timeReclaimed,
      icon: "\u23F1\uFE0F",
      color: "emerald",
    },
  ];

  const handleDayClick = (date: Date) => {
    const key = date.toLocaleDateString("sv-SE");
    const existing = updatesByDate.get(key);

    if (existing) {
      // Date already has an update — show the history detail modal
      setSelectedUpdate(existing);
    } else {
      // No update yet — navigate to the update creation page
      setSelectedDate(date);
      router.push(`/update?date=${key}`);
    }
  };

  function handleDelete(id: string) {
    setLoaded((prev) => prev ? { ...prev, updates: prev.updates.filter((u) => u.id !== id) } : prev);
    setSelectedUpdate(null);
    invalidateResources();
  }

  function handleRetry(update: UpdateData) {
    setSelectedUpdate(null);
    const dateKey = update.date.split("T")[0];
    router.push(`/update?date=${dateKey}&retry=${update.id}`);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6">
      <div className="flex-shrink-0"><StatsBar stats={stats} /></div>
      <Calendar
        updateStatusMap={updateStatusMap}
        leaveDates={leaveSet}
        holidayDates={holidaySet}
        onDayClick={handleDayClick}
        monthTitle={monthTitle}
        calendarDays={calendarDays}
        prevMonth={prevMonth}
        nextMonth={nextMonth}
        goToToday={goToToday}
        loading={monthLoading}
      />
      <p className="mt-auto pt-4 pb-2 text-center text-xs text-white/20">v{process.env.NEXT_PUBLIC_APP_VERSION}</p>

      {selectedUpdate && (
        <HistoryDetailModal
          update={selectedUpdate}
          onClose={() => setSelectedUpdate(null)}
          onDelete={handleDelete}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
}
