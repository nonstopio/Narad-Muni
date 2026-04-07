"use client";

import { useEffect, useState, useCallback } from "react";
import { authedFetch } from "@/lib/api-client";
import { HistoryList } from "@/components/history/history-list";
import { PageSpinner } from "@/components/ui/page-spinner";
import { trackEvent } from "@/lib/analytics";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <div className="flex-1 flex items-center justify-center p-5">
        <div className="glass-card p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-xl bg-narada-rose/10 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-narada-rose">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-narada-text mb-2">Alas! The ancient scrolls remain sealed</h2>
          <p className="text-sm text-narada-text-secondary mb-4">Your chronicles could not be retrieved. This may be a fleeting disturbance.</p>
          <Button variant="secondary" size="sm" onClick={loadHistory} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return <HistoryList updates={updates} />;
}
