"use client";

import { useEffect, useState, useCallback } from "react";
import { authedFetch } from "@/lib/api-client";
import { HistoryList } from "@/components/history/history-list";
import { PageSpinner } from "@/components/ui/page-spinner";
import { PageError } from "@/components/ui/page-error";
import { trackEvent } from "@/lib/analytics";
import type { UpdateData } from "@/types";

export default function HistoryPage() {
  const [updates, setUpdates] = useState<UpdateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadHistory = useCallback(() => {
    setLoading(true);
    setError(false);
    authedFetch("/api/updates")
      .then((r) => {
        if (!r.ok) {
          if (r.status === 401) return null;
          throw new Error(`HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setUpdates(data.updates || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("[Narada] Failed to load history:", err);
        setError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    trackEvent("page_view_history");
    loadHistory();
  }, [loadHistory]);

  if (loading) {
    return <PageSpinner />;
  }

  if (error) {
    return (
      <PageError
        title="Alas! The ancient scrolls remain sealed"
        message="Your chronicles could not be retrieved. This may be a fleeting disturbance."
        onRetry={loadHistory}
      />
    );
  }

  return <HistoryList updates={updates} />;
}
