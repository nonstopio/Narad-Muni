"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/api-client";
import { SettingsClient } from "@/components/settings/settings-client";
import { PageSpinner } from "@/components/ui/page-spinner";
import type { PlatformConfigData } from "@/types";

export default function SettingsPage() {
  const [configs, setConfigs] = useState<PlatformConfigData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authedFetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setConfigs(data.configs || []))
      .catch((err) => console.error("[Narada] Failed to load settings:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <PageSpinner message="Loading sacred configurations..." />;
  }

  return <SettingsClient initialConfigs={configs} />;
}
