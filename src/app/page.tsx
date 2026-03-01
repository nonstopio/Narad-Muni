"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/api-client";
import { UpdatesPageClient } from "@/components/updates/updates-page-client";
import { PageSpinner } from "@/components/ui/page-spinner";
import type { UpdateData } from "@/types";

export default function UpdatesPage() {
  const [updateCount, setUpdateCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [monthUpdates, setMonthUpdates] = useState<UpdateData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    Promise.all([
      authedFetch(`/api/updates?month=${month}`).then((r) => r.json()),
      authedFetch("/api/updates").then((r) => r.json()),
    ])
      .then(([monthData, allData]) => {
        const mUpdates: UpdateData[] = monthData.updates || [];
        setMonthUpdates(mUpdates);
        setUpdateCount(mUpdates.length);

        // Calculate streak client-side
        const allUpdates: UpdateData[] = allData.updates || [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sortedDates = allUpdates
          .map((u) => {
            const d = new Date(u.date);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
          })
          .filter((v, i, a) => a.indexOf(v) === i)
          .sort((a, b) => b - a);

        let s = 0;
        if (sortedDates.length > 0) {
          let checkDate = today.getTime();
          for (const dateTs of sortedDates) {
            if (dateTs === checkDate) {
              s++;
              checkDate -= 86400000;
            } else if (dateTs < checkDate) {
              break;
            }
          }
        }
        setStreak(s);
      })
      .catch((err) => {
        console.error("[Narada] Failed to load updates:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <PageSpinner />;
  }

  return (
    <UpdatesPageClient
      updateCount={updateCount}
      streak={streak}
      monthUpdates={monthUpdates}
    />
  );
}
