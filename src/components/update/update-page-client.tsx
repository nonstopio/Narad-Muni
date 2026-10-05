"use client";

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { useUpdateStore } from "@/stores/update-store";
import { useUpdateFlow } from "@/hooks/use-update-flow";
import { useDraftAutoSave } from "@/hooks/use-draft-auto-save";
import { useToastStore } from "@/components/ui/toast";
import { InputSection } from "./input-section";
import { LEAVE_BLOCKED_COPY } from "@/components/history/history-detail-modal";
import { RetryInputSection } from "./retry-input-section";
import { PlatformOutputs } from "./platform-outputs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Palmtree, PartyPopper } from "lucide-react";
import { computeCombinedStatus } from "@/types";
import type { PlatformConfigData, PublishStatus } from "@/types";
import { authedFetch } from "@/lib/api-client";
import { trackEvent } from "@/lib/analytics";
import type { ShareResult } from "@/hooks/use-update-flow";

interface UpdatePageClientProps {
  platformConfigs: PlatformConfigData[];
}

export function UpdatePageClient({ platformConfigs }: UpdatePageClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);
  const store = useUpdateStore();
  const { initPlatformToggles, resetForNewUpdate, setJiraBaseUrl } = store;
  const { processWithAI, shareAll, retryShare } = useUpdateFlow();
  const [retryLoading, setRetryLoading] = useState(false);

  const dateParam = searchParams.get("date");
  const retryParam = searchParams.get("retry");

  // Leave state for this date; null while unknown. Keyed by date so a stale
  // answer for the previous date is never shown for this one. A holiday is a leave of kind "holiday".
  const [leave, setLeave] = useState<{ date: string; onLeave: boolean; holiday?: boolean } | null>(null);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const onLeave = leave && leave.date === dateParam ? leave.onLeave : null;
  const isHoliday = onLeave === true && leave?.holiday === true;
  const onLeaveRef = useRef(onLeave);
  useEffect(() => { onLeaveRef.current = onLeave; }, [onLeave]);

  useEffect(() => {
    if (retryParam || !dateParam) return;
    let cancelled = false;
    authedFetch(`/api/leaves?date=${dateParam}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setLeave({ date: dateParam, onLeave: data.onLeave === true, holiday: data.kind === "holiday" });
      })
      .catch((err) => {
        console.error("[Narada] Failed to load leave:", err);
        // The server still refuses writes on a leave day, so drafting can proceed.
        if (!cancelled) setLeave({ date: dateParam, onLeave: false });
      });
    return () => {
      cancelled = true;
    };
  }, [dateParam, retryParam]);

  // Auto-save draft text per date (off in retry mode, on leave, and until leave is known)
  const { deleteDraft, flush } = useDraftAutoSave(dateParam, !retryParam && !!dateParam && onLeave === false);

  const markLeave = useCallback(async (kind: "leave" | "holiday") => {
    if (!dateParam) return;
    const date = dateParam;
    setLeaveBusy(true);
    try {
      // Save the last keystrokes under this date before the server freezes its draft.
      await flush();
      const res = await authedFetch("/api/leaves", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, kind }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.error === "update-exists") {
        useToastStore.getState().addToast(LEAVE_BLOCKED_COPY, "error");
        return;
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setLeave({ date, onLeave: true, holiday: kind === "holiday" });
      useToastStore.getState().addToast(
        kind === "holiday" ? "Narayan Narayan! A holiday — even the gods feast today." : "Narayan Narayan! This day is marked for rest.",
        "success",
      );
    } catch (err) {
      console.error("[Narada] Failed to mark leave:", err);
      useToastStore.getState().addToast("Alas! I could not mark this day for rest.", "error");
    } finally {
      setLeaveBusy(false);
    }
  }, [dateParam, flush]);

  const undoLeave = useCallback(async () => {
    if (!dateParam) return;
    const date = dateParam;
    setLeaveBusy(true);
    try {
      const res = await authedFetch(`/api/leaves?date=${date}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLeave({ date, onLeave: false });
      useToastStore.getState().addToast("Narayan Narayan! The day is yours again — your draft awaits.", "success");
    } catch (err) {
      console.error("[Narada] Failed to undo leave:", err);
      useToastStore.getState().addToast("Alas! I could not return this day to you.", "error");
    } finally {
      setLeaveBusy(false);
    }
  }, [dateParam]);

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
    trackEvent("page_view_update");
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
      authedFetch(`/api/updates?id=${retryParam}`)
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

    // Set Jira baseUrl for linkification info note (both normal and retry modes)
    const jiraConfig = platformConfigs.find((c) => c.platform === "JIRA");
    setJiraBaseUrl(jiraConfig?.baseUrl?.trim() || null);

    // Cleanup retry state on unmount
    return () => {
      cancelled = true;
      const s = useUpdateStore.getState();
      // Fire recording_discarded if user typed but left without publishing
      const leftWithUnpublishedWork =
        !s.retryMode &&
        s.step !== "sharing" &&
        s.rawTranscript.trim().length > 0;
      if (leftWithUnpublishedWork) {
        trackEvent("recording_discarded", {
          had_transcript: s.rawTranscript.trim().length > 0,
          preview_ready: s.previewReady,
          transcript_chars: s.rawTranscript.length,
        });
      }
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

  const showShareToast = useCallback((result: ShareResult) => {
    if (!result.success || !result.statuses) return;

    const { slackStatus, teamsStatus, jiraStatus } = result.statuses;
    const combined = computeCombinedStatus(slackStatus, teamsStatus, jiraStatus);

    if (combined === "all-success") {
      useToastStore.getState().addToast(
        "Narayan Narayan! Your word has reached all three worlds!",
        "success"
      );
    } else {
      const failed: string[] = [];
      if (slackStatus === "FAILED") failed.push("Slack");
      if (teamsStatus === "FAILED") failed.push("Teams");
      if (jiraStatus === "FAILED") failed.push("Jira");
      const failedStr = failed.join(" & ");

      if (combined === "partial") {
        useToastStore.getState().addToast(
          `Narayan Narayan! Most worlds received your word, but ${failedStr} could not be reached.`,
          "warning"
        );
      } else {
        useToastStore.getState().addToast(
          "Alas! None of the worlds could be reached. The scroll has been saved for retry.",
          "error"
        );
      }
    }
  }, []);

  const handleShareAll = useCallback(async () => {
    const result = await shareAll();
    if (result.success) {
      await deleteDraft();
      showShareToast(result);
      router.push("/");
    }
  }, [shareAll, deleteDraft, router, showShareToast]);

  const handleRetryShare = useCallback(async () => {
    const result = await retryShare();
    if (result.success) {
      showShareToast(result);
      router.push("/");
    }
  }, [retryShare, router, showShareToast]);

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
      if (onLeaveRef.current) return;
      const { rawTranscript, isProcessing, retryMode } = useUpdateStore.getState();
      if (!retryMode && rawTranscript.trim() && !isProcessing) {
        processRef.current();
      }
    });
    setOnDispatch(() => {
      if (onLeaveRef.current) return;
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
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-semibold text-narada-text">{dateTitle}</h1>
        {isRetryMode && (
          <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-narada-amber">
            Retry Mode
          </span>
        )}
        {!isRetryMode && onLeave === false && (
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => markLeave("leave")} disabled={leaveBusy}>
              <Palmtree className="w-4 h-4" />
              Mark as on leave
            </Button>
            <Button variant="secondary" size="sm" onClick={() => markLeave("holiday")} disabled={leaveBusy}>
              <PartyPopper className="w-4 h-4" />
              Mark as holiday
            </Button>
          </div>
        )}
        {!isRetryMode && onLeave === true && (
          <div className="ml-auto flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-violet-500/10 border border-violet-500/30 text-narada-secondary">
              {isHoliday ? "Holiday" : "On leave"}
            </span>
            <Button variant="ghost" size="sm" onClick={undoLeave} disabled={leaveBusy}>
              Undo
            </Button>
          </div>
        )}
      </div>

      {!isRetryMode && onLeave === true ? (
        <div className="flex flex-1 min-h-0 items-center justify-center p-6">
          <div className="glass-card p-8 max-w-md text-center flex flex-col items-center gap-3">
            {isHoliday ? (
              <PartyPopper className="w-10 h-10 text-narada-secondary" />
            ) : (
              <Palmtree className="w-10 h-10 text-narada-secondary" />
            )}
            <p className="text-base font-semibold text-narada-text">
              {isHoliday
                ? "Narayan Narayan! A holiday — the three worlds celebrate with you."
                : "Narayan Narayan! You rest today — the three worlds can wait."}
            </p>
            <p className="text-sm text-narada-text-secondary">
              Your draft is kept safe. Undo the {isHoliday ? "holiday" : "leave"} to return to it.
            </p>
          </div>
        </div>
      ) : (
      /* Two-column body */
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
      )}
    </div>
  );
}
