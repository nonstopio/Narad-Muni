"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StatsBar } from "./stats-bar";
import { Calendar } from "./calendar";
import { HistoryDetailModal } from "@/components/history/history-detail-modal";
import { useAppStore } from "@/stores/app-store";
import { useCalendar } from "@/hooks/use-calendar";
import { useToastStore } from "@/components/ui/toast";
import { authedFetch } from "@/lib/api-client";
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
}

export function UpdatesPageClient({
  streak,
  monthUpdates: initialMonthUpdates,
  monthLeaves: initialMonthLeaves,
}: Props) {
  const { currentMonth, monthTitle, calendarDays, prevMonth, nextMonth, goToToday } = useCalendar();
  const monthKey = formatMonth(currentMonth);
  // Loading is derived: the shown month is loading until its data has landed.
  const [loaded, setLoaded] = useState({ month: monthKey, updates: initialMonthUpdates, leaves: initialMonthLeaves });
  const monthLoading = loaded.month !== monthKey;
  const monthUpdates = useMemo(() => (monthLoading ? [] : loaded.updates), [monthLoading, loaded]);
  const leaveSet = useMemo(() => new Set<string>(monthLoading ? [] : loaded.leaves), [monthLoading, loaded]);
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (!hasNavigated.current) {
      hasNavigated.current = true;
      return; // skip fetch on mount — we already have initial data
    }

    const controller = new AbortController();
    const getJson = (url: string) =>
      authedFetch(url, { signal: controller.signal }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });
    Promise.all([getJson(`/api/updates?month=${monthKey}`), getJson(`/api/leaves?month=${monthKey}`)])
      .then(([updateData, leaveData]) => {
        if (!controller.signal.aborted) {
          setLoaded({ month: monthKey, updates: updateData.updates || [], leaves: leaveData.leaves || [] });
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error("[Narada] Failed to fetch month updates:", err);
          useToastStore.getState().addToast("Alas! Could not retrieve this month's chronicles", "error");
          setLoaded({ month: monthKey, updates: [], leaves: [] });
        }
      });

    return () => controller.abort();
  }, [monthKey]);

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
    setLoaded((prev) => ({ ...prev, updates: prev.updates.filter((u) => u.id !== id) }));
    setSelectedUpdate(null);
    router.refresh();
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
