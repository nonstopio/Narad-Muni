"use client";

import { useCalendar } from "@/hooks/use-calendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarProps {
  updateDates: Set<string>;
  onDayClick: (date: Date) => void;
}

export function Calendar({ updateDates, onDayClick }: CalendarProps) {
  const { monthTitle, calendarDays, prevMonth, nextMonth } = useCalendar();

  const hasUpdate = (date: Date) => {
    const key = date.toLocaleDateString("sv-SE");
    return updateDates.has(key);
  };

  return (
    <div className="glass-card p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-3">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.06] text-narada-text-secondary hover:bg-white/[0.1] hover:text-narada-text flex items-center justify-center transition-all duration-300"
          >
            &larr;
          </button>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.06] text-narada-text-secondary hover:bg-white/[0.1] hover:text-narada-text flex items-center justify-center transition-all duration-300"
          >
            &rarr;
          </button>
        </div>
        <div className="text-lg font-semibold text-narada-text">
          {monthTitle}
        </div>
        <div />
      </div>

      <div className="grid grid-cols-7 gap-2 mb-3">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-semibold text-narada-text-muted py-2"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, i) => (
          <button
            key={i}
            onClick={() => day.isCurrentMonth && onDayClick(day.date)}
            className={`aspect-square rounded-xl flex flex-col items-center justify-center relative text-sm font-medium transition-all duration-300 ${
              !day.isCurrentMonth
                ? "text-narada-text-muted opacity-50"
                : day.isToday
                  ? "border border-narada-primary bg-blue-500/10 text-narada-text shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                  : "bg-white/[0.02] border border-transparent text-narada-text-secondary hover:bg-white/[0.05] hover:border-white/[0.06]"
            }`}
          >
            {day.day}
            {day.isCurrentMonth && hasUpdate(day.date) && (
              <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-narada-emerald shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
