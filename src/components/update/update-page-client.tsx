"use client";

import { useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { useUpdateStore } from "@/stores/update-store";
import { useUpdateFlow } from "@/hooks/use-update-flow";
import { useToastStore } from "@/components/ui/toast";
import { InputSection } from "./input-section";
import { PlatformOutputs } from "./platform-outputs";
import { ArrowLeft } from "lucide-react";
import type { PlatformConfigData } from "@/types";

interface UpdatePageClientProps {
  platformConfigs: PlatformConfigData[];
}

export function UpdatePageClient({ platformConfigs }: UpdatePageClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);
  const { initPlatformToggles, resetForNewUpdate } = useUpdateStore();
  const { processWithAI, shareAll } = useUpdateFlow();

  const dateParam = searchParams.get("date");

  // Derive which platforms are globally active from DB configs
  const activePlatforms = useMemo(
    () => ({
      slack:
        platformConfigs.find((c) => c.platform === "SLACK")?.isActive ?? false,
      teams:
        platformConfigs.find((c) => c.platform === "TEAMS")?.isActive ?? false,
      jira:
        platformConfigs.find((c) => c.platform === "JIRA")?.isActive ?? false,
    }),
    [platformConfigs]
  );

  // Initialize on mount
  useEffect(() => {
    // Parse date from query param
    if (dateParam) {
      const parsed = new Date(dateParam + "T00:00:00");
      if (!isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
      }
    }
    // Set toggles from DB and clear stale state
    initPlatformToggles(platformConfigs);
    resetForNewUpdate();
  }, [dateParam, platformConfigs, setSelectedDate, initPlatformToggles, resetForNewUpdate]);

  // Format the date for the header
  const dateTitle = useMemo(() => {
    if (!dateParam) return "Compose Your Message";
    const parsed = new Date(dateParam + "T00:00:00");
    if (isNaN(parsed.getTime())) return "Compose Your Message";
    return parsed.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [dateParam]);

  const handleShareAll = useCallback(async () => {
    const success = await shareAll();
    if (success) {
      useToastStore.getState().addToast("Narayan Narayan! Your word has reached all three worlds!", "success");
      router.push("/");
    }
  }, [shareAll, router]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="px-8 py-5 border-b border-white/[0.06] flex items-center gap-4 flex-shrink-0">
        <button
          onClick={() => router.push("/")}
          className="text-narada-text-secondary hover:text-narada-text transition-all duration-300 p-1.5 rounded-lg hover:bg-white/[0.06]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-narada-text">{dateTitle}</h1>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0">
        {/* Left column — Input */}
        <div className="w-[420px] min-w-[420px] p-6 border-r border-white/[0.06] overflow-y-auto">
          <InputSection onProcess={processWithAI} />
        </div>

        {/* Right column — Platform outputs */}
        <div className="flex-1 p-6 overflow-y-auto relative">
          <PlatformOutputs
            activePlatforms={activePlatforms}
            onShareAll={handleShareAll}
          />
        </div>
      </div>
    </div>
  );
}
