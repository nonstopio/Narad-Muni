"use client";

import { useEffect, useState, useCallback } from "react";
import { authedFetch } from "@/lib/api-client";
import { SettingsClient } from "@/components/settings/settings-client";
import { PageSpinner } from "@/components/ui/page-spinner";
import { PageError } from "@/components/ui/page-error";
import { trackEvent } from "@/lib/analytics";
import type { PlatformConfigData } from "@/types";

export default function SettingsPage() {
  const [configs, setConfigs] = useState<PlatformConfigData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadSettings = useCallback(() => {
    setLoading(true);
    setError(false);
    authedFetch("/api/settings")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setConfigs(data.configs || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[Narada] Failed to load settings:", err);
        setError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    trackEvent("page_view_settings");
    loadSettings();
  }, [loadSettings]);

  if (loading) {
    return <PageSpinner message="Loading sacred configurations..." />;
  }

  if (error) {
    return (
      <PageError
        title="Alas! The sacred scrolls could not be retrieved"
        message="The configurations elude me. This may be a fleeting disturbance."
        onRetry={loadSettings}
      />
    );
  }

  return <SettingsClient initialConfigs={configs} />;
}
