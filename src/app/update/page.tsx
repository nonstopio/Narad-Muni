"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/api-client";
import { UpdatePageClient } from "@/components/update/update-page-client";
import { PageSpinner } from "@/components/ui/page-spinner";
import type { PlatformConfigData } from "@/types";

export default function UpdatePage() {
  const [configs, setConfigs] = useState<PlatformConfigData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authedFetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setConfigs(data.configs || []))
      .catch((err) => console.error("[Narada] Failed to load configs:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <PageSpinner message="Preparing the sacred scrolls..." />;
  }

  return <UpdatePageClient platformConfigs={configs} />;
}
