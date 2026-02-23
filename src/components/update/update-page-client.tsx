"use client";

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { useUpdateStore } from "@/stores/update-store";
import { useUpdateFlow } from "@/hooks/use-update-flow";
import { useToastStore } from "@/components/ui/toast";
import { InputSection } from "./input-section";
import { RetryInputSection } from "./retry-input-section";
import { PlatformOutputs } from "./platform-outputs";
import { ArrowLeft } from "lucide-react";
import type { PlatformConfigData, PublishStatus } from "@/types";

interface UpdatePageClientProps {
  platformConfigs: PlatformConfigData[];
}

export function UpdatePageClient({ platformConfigs }: UpdatePageClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);
  const store = useUpdateStore();
  const { initPlatformToggles, resetForNewUpdate } = store;
  const { processWithAI, shareAll, retryShare } = useUpdateFlow();
  const [retryLoading, setRetryLoading] = useState(false);

  const dateParam = searchParams.get("date");
  const retryParam = searchParams.get("retry");

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

  // Initialize on mount — either normal or retry mode
  useEffect(() => {
    // Parse date from query param
    if (dateParam) {
      const parsed = new Date(dateParam + "T00:00:00");
      if (!isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
      }
    }

    let cancelled = false;

    if (retryParam) {
      // Retry mode — clear stale normal-mode state first, then fetch existing update
      resetForNewUpdate();
      setRetryLoading(true);
      fetch(`/api/updates?id=${retryParam}`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          if (!data.update) {
            useToastStore.getState().addToast("Alas! The scroll could not be found.", "error");
            router.push("/");
            return;
          }
          const u = data.update;
          const s = useUpdateStore.getState();

          // Populate store with existing data
          s.setRawTranscript(u.rawTranscript || "");
          s.setSlackOutput(u.slackOutput || "");
          s.setTeamsOutput(u.teamsOutput || "");
          s.setWorkLogEntries(
            (u.workLogEntries || []).map((e: { id?: string; issueKey: string; timeSpentSecs: number; started: string; comment?: string; isRepeat: boolean; jiraWorklogId?: string | null }) => ({
              id: e.id,
              issueKey: e.issueKey,
              timeSpentSecs: e.timeSpentSecs,
              started: e.started,
              comment: e.comment || "",
              isRepeat: e.isRepeat,
              jiraWorklogId: e.jiraWorklogId,
            }))
          );

          // Set retry state
          s.setRetryMode(true);
          s.setRetryUpdateId(u.id);
          s.setRetryStatuses(
            u.slackStatus as PublishStatus,
            u.teamsStatus as PublishStatus,
            u.jiraStatus as PublishStatus
          );

          // Set platform toggles based on original statuses:
          // SENT → enabled (locked), FAILED → enabled (editable), SKIPPED → disabled
          const slackOn = u.slackStatus === "SENT" || u.slackStatus === "FAILED";
          const teamsOn = u.teamsStatus === "SENT" || u.teamsStatus === "FAILED";
          const jiraOn = u.jiraStatus === "SENT" || u.jiraStatus === "FAILED";

          // Directly set toggles (don't use initPlatformToggles which reads DB config)
          useUpdateStore.setState({
            slackEnabled: slackOn,
            teamsEnabled: teamsOn,
            jiraEnabled: jiraOn,
            previewReady: true,
          });

          setRetryLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("Failed to load retry update:", err);
          useToastStore.getState().addToast("Alas! Could not load the scroll for retry.", "error");
          setRetryLoading(false);
          router.push("/");
        });
    } else {
      // Normal mode — set toggles from DB and clear stale state
      initPlatformToggles(platformConfigs);
      resetForNewUpdate();
    }

    // Cleanup retry state on unmount
    return () => {
      cancelled = true;
      const s = useUpdateStore.getState();
      if (s.retryMode) {
        s.setRetryMode(false);
        s.setRetryUpdateId(null);
        s.setRetryStatuses(null, null, null);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateParam, retryParam]);

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

  const handleRetryShare = useCallback(async () => {
    const success = await retryShare();
    if (success) {
      useToastStore.getState().addToast("Narayan Narayan! The failed scrolls have been re-dispatched!", "success");
      router.push("/");
    }
  }, [retryShare, router]);

  const isRetryMode = store.retryMode;
  const dispatchHandler = isRetryMode ? handleRetryShare : handleShareAll;

  // Register keyboard shortcut callbacks (refs avoid re-render loop)
  const processRef = useRef(processWithAI);
  const shareRef = useRef(dispatchHandler);
  useEffect(() => { processRef.current = processWithAI; }, [processWithAI]);
  useEffect(() => { shareRef.current = dispatchHandler; }, [dispatchHandler]);

  useEffect(() => {
    const { setOnInvokeSage, setOnDispatch } = useUpdateStore.getState();
    setOnInvokeSage(() => {
      const { rawTranscript, isProcessing, retryMode } = useUpdateStore.getState();
      if (!retryMode && rawTranscript.trim() && !isProcessing) {
        processRef.current();
      }
    });
    setOnDispatch(() => {
      const { previewReady, step } = useUpdateStore.getState();
      if (previewReady && step !== "sharing") {
        shareRef.current();
      }
    });
    return () => {
      const s = useUpdateStore.getState();
      s.setOnInvokeSage(null);
      s.setOnDispatch(null);
    };
  }, []);

  if (retryLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-narada-text-muted animate-pulse">Loading scroll for retry...</p>
      </div>
    );
  }

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
        {isRetryMode && (
          <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-narada-amber">
            Retry Mode
          </span>
        )}
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0">
        {/* Left column — Input or Retry info */}
        <div className="w-[420px] min-w-[420px] p-6 border-r border-white/[0.06] overflow-y-auto">
          {isRetryMode ? (
            <RetryInputSection />
          ) : (
            <InputSection onProcess={processWithAI} />
          )}
        </div>

        {/* Right column — Platform outputs */}
        <div className="flex-1 p-6 overflow-y-auto relative">
          <PlatformOutputs
            activePlatforms={activePlatforms}
            onShareAll={dispatchHandler}
          />
        </div>
      </div>
    </div>
  );
}
