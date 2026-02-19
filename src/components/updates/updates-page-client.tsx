"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StatsBar } from "./stats-bar";
import { Calendar } from "./calendar";
import { HistoryDetailModal } from "@/components/history/history-detail-modal";
import { useAppStore } from "@/stores/app-store";
import type { StatData, UpdateData } from "@/types";

interface Props {
  updateCount: number;
  streak: number;
  monthUpdates: UpdateData[];
}

export function UpdatesPageClient({
  updateCount,
  streak,
  monthUpdates: initialMonthUpdates,
}: Props) {
  const [monthUpdates, setMonthUpdates] = useState(initialMonthUpdates);
  const updateDatesSet = useMemo(
    () => new Set(monthUpdates.map((u) => u.date.split("T")[0])),
    [monthUpdates]
  );
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
      label: "Messages This Month",
      value: updateCount,
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
      value: `${updateCount * 15}m`,
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6">
      <div className="flex-shrink-0"><StatsBar stats={stats} /></div>
      <Calendar updateDates={updateDatesSet} onDayClick={handleDayClick} />

      {selectedUpdate && (
        <HistoryDetailModal
          update={selectedUpdate}
          onClose={() => setSelectedUpdate(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
