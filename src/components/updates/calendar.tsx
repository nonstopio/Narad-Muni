"use client";

import { useCalendar } from "@/hooks/use-calendar";
import { Button } from "@/components/ui/button";
import type { CombinedStatus } from "@/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_STYLES: Record<CombinedStatus, string> = {
  "all-success": "bg-emerald-500/15 border border-emerald-500/30 text-narada-emerald shadow-[0_0_12px_rgba(16,185,129,0.2)]",
  "partial": "bg-amber-500/15 border border-amber-500/30 text-narada-amber shadow-[0_0_12px_rgba(245,158,11,0.2)]",
  "all-failed": "bg-rose-500/15 border border-rose-500/30 text-narada-rose shadow-[0_0_12px_rgba(239,68,68,0.2)]",
};

interface CalendarProps {
  updateStatusMap: Map<string, CombinedStatus>;
  onDayClick: (date: Date) => void;
}

export function Calendar({ updateStatusMap, onDayClick }: CalendarProps) {
  const { monthTitle, calendarDays, prevMonth, nextMonth, goToToday } = useCalendar();

  const getUpdateStatus = (date: Date): CombinedStatus | null => {
    const key = date.toLocaleDateString("sv-SE");
    return updateStatusMap.get(key) ?? null;
  };

  return (
    <div className="glass-card p-5 flex-1 flex flex-col min-h-0">
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-3">
          <Button variant="secondary" size="icon-sm" onClick={prevMonth}>
            &larr;
          </Button>
          <Button variant="secondary" size="icon-sm" onClick={nextMonth}>
            &rarr;
          </Button>
        </div>
        <div className="text-lg font-semibold text-narada-text">
          {monthTitle}
        </div>
        <Button variant="secondary" size="sm" onClick={goToToday}>
          Today
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-semibold text-narada-text-muted py-1"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 flex-1 auto-rows-fr">
        {calendarDays.map((day, i) => {
          const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
          const status = day.isCurrentMonth ? getUpdateStatus(day.date) : null;
          return (
            <button
              key={i}
              onClick={() => day.isCurrentMonth && onDayClick(day.date)}
              className={`min-h-[2.25rem] rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                !day.isCurrentMonth
                  ? "text-narada-text-muted opacity-30"
                  : status
                    ? STATUS_STYLES[status]
                    : day.isToday
                      ? "border border-narada-primary bg-blue-500/10 text-narada-text shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                      : isWeekend
                        ? "bg-white/[0.01] border border-transparent text-narada-text-muted"
                        : "bg-white/[0.04] border border-white/[0.04] text-narada-text-secondary hover:bg-white/[0.07] hover:border-white/[0.08]"
              }`}
            >
              {day.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
