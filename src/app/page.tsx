"use client";

import { useEffect, useState, useCallback } from "react";
import { authedFetch } from "@/lib/api-client";
import { trackEvent } from "@/lib/analytics";
import { UpdatesPageClient } from "@/components/updates/updates-page-client";
import { PageSpinner } from "@/components/ui/page-spinner";
import { PageError } from "@/components/ui/page-error";
import { computeStreak, updateKeysOf } from "@/lib/streak";
import type { UpdateData } from "@/types";

export default function UpdatesPage() {
  const [streak, setStreak] = useState(0);
  const [monthUpdates, setMonthUpdates] = useState<UpdateData[]>([]);
  const [monthLeaves, setMonthLeaves] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadUpdates = useCallback(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    Promise.all([
      authedFetch(`/api/updates?month=${month}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      authedFetch("/api/updates").then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
      authedFetch("/api/leaves").then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
    ])
      .then(([monthData, allData, leaveData]) => {

        const mUpdates: UpdateData[] = monthData.updates || [];
        setMonthUpdates(mUpdates);

        const allUpdates: UpdateData[] = allData.updates || [];
        const leaves: string[] = leaveData.leaves || [];
        setMonthLeaves(leaves.filter((k) => k.startsWith(month)));
        setStreak(computeStreak(updateKeysOf(allUpdates), new Set(leaves), new Date().toLocaleDateString("sv-SE")));
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
        onRetry={() => {
          setLoading(true);
          setError(false);
          loadUpdates();
        }}
      />
    );
  }

  return (
    <UpdatesPageClient
      streak={streak}
      monthUpdates={monthUpdates}
      monthLeaves={monthLeaves}
    />
  );
}
