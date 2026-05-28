"use client";

import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/api-client";
import { PageSpinner } from "@/components/ui/page-spinner";
import { GlobalAIOracleCard } from "./global-ai-oracle-card";

export function AdminSettingsClient() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    authedFetch("/api/admin/check")
      .then((r) => r.json())
      .then((d) => setAllowed(!!d.isAdmin))
      .catch(() => setAllowed(false));
  }, []);

  if (allowed === null) {
    return <PageSpinner message="The sage verifies your standing..." />;
  }

  if (!allowed) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass-card p-8 text-center max-w-md">
          <p className="text-xl narada-text mb-2">Narayan Narayan!</p>
          <p className="narada-text-secondary">
            Only the highest sages may enter the sanctum.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold narada-text">Sacred Sanctum</h1>
        <p className="text-sm narada-text-secondary mt-1">
          Global decrees that shape the world for every devotee.
        </p>
      </div>

      <GlobalAIOracleCard />
    </div>
  );
}
