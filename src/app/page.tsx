"use client";

import { useEffect, useState, useCallback } from "react";
import { authedFetch } from "@/lib/api-client";
import { trackEvent } from "@/lib/analytics";
import { UpdatesPageClient } from "@/components/updates/updates-page-client";
import { PageSpinner } from "@/components/ui/page-spinner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        if (!monthData || !allData) return; // 401 — AuthGuard handles redirect

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
      <div className="flex-1 flex items-center justify-center p-5">
        <div className="glass-card p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-xl bg-narada-rose/10 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-narada-rose">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-narada-text mb-2">Alas! The chronicles could not be summoned</h2>
          <p className="text-sm text-narada-text-secondary mb-4">The sacred records elude me. This may be a fleeting disturbance.</p>
          <Button variant="secondary" size="sm" onClick={loadUpdates} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <UpdatesPageClient
      streak={streak}
      monthUpdates={monthUpdates}
    />
  );
}
