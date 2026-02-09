"use client";

import { useState, useMemo } from "react";

export function useCalendar() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const prevMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const today = new Date();

    const days: {
      day: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      date: Date;
    }[] = [];

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      days.push({
        day,
        isCurrentMonth: false,
        isToday: false,
        date: new Date(year, month - 1, day),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const isToday =
        today.getDate() === i &&
        today.getMonth() === month &&
        today.getFullYear() === year;
      days.push({
        day: i,
        isCurrentMonth: true,
        isToday,
        date: new Date(year, month, i),
      });
    }

    // Next month leading days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        isToday: false,
        date: new Date(year, month + 1, i),
      });
    }

    return days;
  }, [currentMonth]);

  const monthTitle = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return { currentMonth, monthTitle, calendarDays, prevMonth, nextMonth };
}
