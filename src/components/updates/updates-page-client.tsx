"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StatsBar } from "./stats-bar";
import { Calendar } from "./calendar";
import { HistoryDetailModal } from "@/components/history/history-detail-modal";
import { useAppStore } from "@/stores/app-store";
import { useCalendar } from "@/hooks/use-calendar";
import { authedFetch } from "@/lib/api-client";
import { computeCombinedStatus } from "@/types";
import type { CombinedStatus, StatData, UpdateData } from "@/types";

function formatMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

interface Props {
  updateCount: number;
  streak: number;
  monthUpdates: UpdateData[];
}

export function UpdatesPageClient({
  streak,
  monthUpdates: initialMonthUpdates,
}: Props) {
  const { currentMonth, monthTitle, calendarDays, prevMonth, nextMonth, goToToday } = useCalendar();
  const [monthUpdates, setMonthUpdates] = useState(initialMonthUpdates);
  const [monthLoading, setMonthLoading] = useState(false);
  const initialMonthRef = useRef<string>(formatMonth(new Date()));

  useEffect(() => {
    const monthStr = formatMonth(currentMonth);
    if (monthStr === initialMonthRef.current && monthUpdates === initialMonthUpdates) {
      return; // skip fetch on mount — we already have initial data
    }

    const controller = new AbortController();
    setMonthLoading(true);
    authedFetch(`/api/updates?month=${monthStr}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (!controller.signal.aborted) {
          setMonthUpdates(data.updates || []);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error("[Narada] Failed to fetch month updates:", err);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setMonthLoading(false);
        }
      });

    return () => controller.abort();
  }, [currentMonth]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const stats: StatData[] = [
    {
      label: "Scrolls This Month",
      value: monthUpdates.length,
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
      value: `${monthUpdates.length * 12}m`,
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
    setMonthUpdates((prev) => prev.filter((u) => u.id !== id));
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
