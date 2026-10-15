"use client";

import { useResource } from "@/lib/resource-cache";
import { UpdatePageClient } from "@/components/update/update-page-client";
import { Button } from "@/components/ui/button";
import type { PlatformConfigData } from "@/types";

const EMPTY_CONFIGS: PlatformConfigData[] = [];

export default function UpdatePage() {
  const { data, loading, error, refresh } = useResource<{ configs: PlatformConfigData[] }>("/api/settings?editor=1");
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {(loading || error) && (
        <div role="status" className="flex items-center gap-3 px-8 py-2 text-xs text-narada-text-muted">
          {loading ? "I am refreshing the portals — you may begin your words." : "Alas! I could not refresh the portals. I shall keep your words on this device."}
          {error && <Button variant="ghost" size="sm" onClick={refresh}>Refresh portals</Button>}
        </div>
      )}
      <UpdatePageClient platformConfigs={data?.configs ?? EMPTY_CONFIGS} />
    </div>
  );
}
