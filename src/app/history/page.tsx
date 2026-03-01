"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/api-client";
import { HistoryList } from "@/components/history/history-list";
import { PageSpinner } from "@/components/ui/page-spinner";
import type { UpdateData } from "@/types";

export default function HistoryPage() {
  const [updates, setUpdates] = useState<UpdateData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authedFetch("/api/updates")
      .then((r) => r.json())
      .then((data) => setUpdates(data.updates || []))
      .catch((err) => console.error("[Narada] Failed to load history:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <PageSpinner />;
  }

  return <HistoryList updates={updates} />;
}
