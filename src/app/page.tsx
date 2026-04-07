"use client";

import { useEffect, useState, useCallback } from "react";
import { authedFetch } from "@/lib/api-client";
import { trackEvent } from "@/lib/analytics";
import { UpdatesPageClient } from "@/components/updates/updates-page-client";
import { PageSpinner } from "@/components/ui/page-spinner";
import { PageError } from "@/components/ui/page-error";
import type { UpdateData } from "@/types";

export default function UpdatesPage() {
  const [streak, setStreak] = useState(0);
  const [monthUpdates, setMonthUpdates] = useState<UpdateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadUpdates = useCallback(() => {
    setLoading(true);
    setError(false);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    Promise.all([
      authedFetch(`/api/updates?month=${month}`).then((r) => {
        if (!r.ok) {
          if (r.status === 401) return null;
          throw new Error(`HTTP ${r.status}`);
        }
        return r.json();
      }),
      authedFetch("/api/updates").then((r) => {
        if (!r.ok) {
          if (r.status === 401) return null;
          throw new Error(`HTTP ${r.status}`);
        }
        return r.json();
      }),
    ])
      .then(([monthData, allData]) => {
        if (!monthData || !allData) return; // 401 — keep spinner, AuthGuard redirects

        const mUpdates: UpdateData[] = monthData.updates || [];
        setMonthUpdates(mUpdates);

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
        setLoading(false);
      })
      .catch((err) => {
        console.error("[Narada] Failed to load updates:", err);
        setError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    trackEvent("page_view_home");
    loadUpdates();
  }, [loadUpdates]);

  if (loading) {
    return <PageSpinner />;
  }

  if (error) {
    return (
      <PageError
        title="Alas! The chronicles could not be summoned"
        message="The sacred records elude me. This may be a fleeting disturbance."
        onRetry={loadUpdates}
      />
    );
  }

  return (
    <UpdatesPageClient
      streak={streak}
      monthUpdates={monthUpdates}
    />
  );
}
