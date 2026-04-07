"use client";

import { useEffect, useState, useCallback } from "react";
import { authedFetch } from "@/lib/api-client";
import { UpdatePageClient } from "@/components/update/update-page-client";
import { PageSpinner } from "@/components/ui/page-spinner";
import { PageError } from "@/components/ui/page-error";
import type { PlatformConfigData } from "@/types";

export default function UpdatePage() {
  const [configs, setConfigs] = useState<PlatformConfigData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadConfigs = useCallback(() => {
    setLoading(true);
    setError(false);
    authedFetch("/api/settings")
      .then((r) => {
        if (!r.ok) {
          if (r.status === 401) return null;
          throw new Error(`HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setConfigs(data.configs || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("[Narada] Failed to load configs:", err);
        setError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  if (loading) {
    return <PageSpinner message="Preparing the sacred scrolls..." />;
  }

  if (error) {
    return (
      <PageError
        title="Alas! The sacred scrolls could not be prepared"
        message="Your platform configurations elude me. This may be a fleeting disturbance."
        onRetry={loadConfigs}
      />
    );
  }

  return <UpdatePageClient platformConfigs={configs} />;
}
