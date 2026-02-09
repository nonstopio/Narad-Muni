"use client";

import { useCalendar } from "@/hooks/use-calendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarProps {
  updateDates: Set<string>;
  onDayClick: (date: Date) => void;
}

export function Calendar({ updateDates, onDayClick }: CalendarProps) {
  const { monthTitle, calendarDays, prevMonth, nextMonth, goToToday } = useCalendar();

  const hasUpdate = (date: Date) => {
    const key = date.toLocaleDateString("sv-SE");
    return updateDates.has(key);
  };

  return (
    <div className="glass-card p-5 flex-1 flex flex-col min-h-0">
      <div className="flex justify-between items-center mb-4">
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
        <button
          onClick={goToToday}
          className="h-8 px-3 rounded-xl bg-white/[0.05] border border-white/[0.06] text-xs font-medium text-narada-text-secondary hover:bg-white/[0.1] hover:text-narada-text transition-all duration-300"
        >
          Today
        </button>
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
          return (
            <button
              key={i}
              onClick={() => day.isCurrentMonth && onDayClick(day.date)}
              className={`min-h-[2.25rem] rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                !day.isCurrentMonth
                  ? "text-narada-text-muted opacity-30"
                  : hasUpdate(day.date)
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-narada-emerald shadow-[0_0_12px_rgba(16,185,129,0.2)]"
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
