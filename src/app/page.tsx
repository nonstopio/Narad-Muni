"use client";

import { useEffect } from "react";
import { useResource } from "@/lib/resource-cache";
import { trackEvent } from "@/lib/analytics";
import { UpdatesPageClient } from "@/components/updates/updates-page-client";
import { PageSpinner } from "@/components/ui/page-spinner";
import { PageError } from "@/components/ui/page-error";
import type { UpdateData } from "@/types";

export default function UpdatesPage() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = now.toLocaleDateString("sv-SE");
  const { data, loading, error, refresh } = useResource<{
    streak: number; updates: UpdateData[]; leaves: string[]; holidays: string[];
  }>(`/api/updates?dashboard=1&month=${month}&today=${today}`);
  useEffect(() => { trackEvent("page_view_home"); }, []);

  if (loading) {
    return <PageSpinner />;
  }

  if (error && !data) {
    return (
      <PageError
        title="Alas! The chronicles could not be summoned"
        message="The sacred records elude me. This may be a fleeting disturbance."
        onRetry={refresh}
      />
    );
  }

  return (
    <UpdatesPageClient
      streak={data?.streak ?? 0}
      monthUpdates={data?.updates ?? []}
      monthLeaves={data?.leaves ?? []}
      monthHolidays={data?.holidays ?? []}
    />
  );
}
