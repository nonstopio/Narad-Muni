"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatsBar } from "./stats-bar";
import { Calendar } from "./calendar";
import { useAppStore } from "@/stores/app-store";
import type { StatData } from "@/types";

interface Props {
  updateCount: number;
  streak: number;
  successRate: number;
  updateDates: string[];
}

export function UpdatesPageClient({
  updateCount,
  streak,
  successRate,
  updateDates: initialDates,
}: Props) {
  const [updateDatesSet] = useState(() => new Set(initialDates));
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);
  const router = useRouter();

  const stats: StatData[] = [
    {
      label: "Updates This Month",
      value: updateCount,
      icon: "\u{1F4CA}",
      color: "blue",
    },
    {
      label: "Day Streak",
      value: streak,
      icon: "\u{1F525}",
      color: "violet",
    },
    {
      label: "Avg Time Saved",
      value: "8m",
      icon: "\u23F1\uFE0F",
      color: "emerald",
    },
    {
      label: "Publish Success %",
      value: `${successRate}%`,
      icon: "\u2713",
      color: "amber",
    },
  ];

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    router.push(`/update?date=${date.toLocaleDateString("sv-SE")}`);
  };

  return (
    <div className="overflow-y-auto p-8">
      <h1 className="text-[28px] font-bold text-narada-text mb-6">Updates</h1>
      <StatsBar stats={stats} />
      <Calendar updateDates={updateDatesSet} onDayClick={handleDayClick} />
    </div>
  );
}
