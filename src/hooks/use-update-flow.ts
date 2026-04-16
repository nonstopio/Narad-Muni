"use client";

import { useCallback } from "react";
import { useUpdateStore } from "@/stores/update-store";
import { useAppStore } from "@/stores/app-store";
import { useToastStore } from "@/components/ui/toast";
import { authedFetch } from "@/lib/api-client";
import { trackEvent, classifyError } from "@/lib/analytics";
import { traceAsync, startTrace, stopTrace } from "@/lib/performance";
import type { PublishStatus } from "@/types";

export interface ShareResult {
  success: boolean;
  statuses?: {
    slackStatus: PublishStatus;
    teamsStatus: PublishStatus;
    jiraStatus: PublishStatus;
  };
}

export function useUpdateFlow() {
  const store = useUpdateStore();
  const selectedDate = useAppStore((s) => s.selectedDate);

  const processWithAI = useCallback(async () => {
    const {
      rawTranscript,
      audioBlob,
      slackEnabled,
      teamsEnabled,
      jiraEnabled,
      setSlackOutput,
      setTeamsOutput,
      setWorkLogEntries,
      setRawTranscript,
      setProcessingError,
      setProcessingStage,
      setIsProcessing,
      setPreviewReady,
      mergeMetricsHints,
      setMetricsHints,
    } = store;
    setMetricsHints(null);

    if (!rawTranscript && !audioBlob) return;

    if (!slackEnabled && !teamsEnabled && !jiraEnabled) {
      useToastStore.getState().addToast(
        "Narayan Narayan! Enable at least one world in Sacred Configurations — whom shall I carry your word to?",
        "error"
      );
      return;
    }

    // Stay on "editing" step — processing happens inline in the right panel
    setIsProcessing(true);
    setPreviewReady(false);
    setProcessingError(null);

    let flowTrace: Awaited<ReturnType<typeof startTrace>> = null;
    try {
      flowTrace = await startTrace("narada_full_update_flow");
      let transcript = rawTranscript;

      // Transcribe audio if we have a blob but no text
      if (audioBlob && !transcript) {
        trackEvent("transcription_start", { audio_size_bytes: audioBlob.size });
        setProcessingStage("transcribing");
        console.log("[Narada] Transcribing audio blob:", audioBlob.size, "bytes, type:", audioBlob.type);

        const transcribeStart = Date.now();
        const transcribeData = await traceAsync("narada_transcribe", async () => {
          const formData = new FormData();
          formData.append("audio", audioBlob, "recording.webm");

          const transcribeRes = await authedFetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });
          return transcribeRes.json();
        });
        const transcribeWallMs = Date.now() - transcribeStart;
        console.log("[Narada] Transcription response:", transcribeData);

        if (!transcribeData.success) {
          trackEvent("processing_error", { stage: "transcribe", reason: classifyError(transcribeData.error) });
          throw new Error(transcribeData.error || "Transcription failed");
        }

        transcript = transcribeData.transcript ?? "";
        setRawTranscript(transcript);

        const deepgramMs = transcribeData._timings?.deepgramMs;
        mergeMetricsHints({
          audioSizeBytes: audioBlob.size,
          transcriptChars: transcript.length,
          transcribeMs: transcribeWallMs,
          deepgramMs,
        });
        trackEvent("transcription_complete", {
          duration_ms: transcribeWallMs,
          deepgram_ms: typeof deepgramMs === "number" ? deepgramMs : -1,
          audio_size_bytes: audioBlob.size,
          transcript_chars: transcript.length,
        });
      } else {
        setProcessingStage("transcribing");
        // Brief pause so user sees transcript stage
        await new Promise((r) => setTimeout(r, 300));
      }

      // Parse with AI
      trackEvent("ai_processing_start", { transcript_chars: transcript.length });
      setProcessingStage("analyzing");
      const dateStr = selectedDate
        ? selectedDate.toLocaleDateString("sv-SE")
        : new Date().toLocaleDateString("sv-SE");

      const parseStart = Date.now();
      const parseData = await traceAsync("narada_ai_parse", async () => {
        const parseRes = await authedFetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript, date: dateStr }),
        });
        return parseRes.json();
      });
      const parseWallMs = Date.now() - parseStart;

      if (!parseData.success) {
        trackEvent("processing_error", { stage: "parse", reason: classifyError(parseData.error) });
        throw new Error(parseData.error || "Parsing failed");
      }

      const { data } = parseData;
      const providerMs: number | undefined = parseData._timings?.providerMs;
      const provider: string = parseData._timings?.provider ?? "unknown";
      const taskCount: number = Array.isArray(data?.tasks) ? data.tasks.length : 0;
      const blockerCount: number = Array.isArray(data?.blockers) ? data.blockers.length : 0;
      const timeEntryCount: number = Array.isArray(data?.timeEntries) ? data.timeEntries.length : 0;

      mergeMetricsHints({
        aiProvider: provider,
        aiParseMs: parseWallMs,
        aiProviderMs: providerMs,
        taskCount,
        blockerCount,
      });
      trackEvent("ai_processing_complete", {
        duration_ms: parseWallMs,
        provider_ms: typeof providerMs === "number" ? providerMs : -1,
        provider,
        task_count: taskCount,
        blocker_count: blockerCount,
        time_entry_count: timeEntryCount,
      });
      setProcessingStage("formatting");
      setSlackOutput(data.slackFormat);
      setTeamsOutput(data.teamsFormat);
      setWorkLogEntries(
        data.timeEntries.map((entry: { issueKey: string; timeSpentSecs: number; started: string; comment: string; isRepeat: boolean }) => ({
          issueKey: entry.issueKey,
          timeSpentSecs: entry.timeSpentSecs,
          started: entry.started,
          comment: entry.comment,
          isRepeat: entry.isRepeat,
        }))
      );

      // Brief delay so user sees formatting complete
      await new Promise((r) => setTimeout(r, 400));
      setProcessingStage(null);
      setIsProcessing(false);
      setPreviewReady(true);
      stopTrace(flowTrace);
    } catch (error) {
      console.error("[Narada] Processing error:", error);
      const message = error instanceof Error ? error.message : "Something went wrong";
      trackEvent("processing_error", { stage: "process", reason: classifyError(error) });
      setProcessingError(message);
      setProcessingStage(null);
      setIsProcessing(false);
      stopTrace(flowTrace);
    }
  }, [store, selectedDate]);

  const shareAll = useCallback(async (): Promise<ShareResult> => {
    const {
      rawTranscript,
      slackOutput,
      teamsOutput,
      workLogEntries,
      slackEnabled,
      teamsEnabled,
      jiraEnabled,
      setStep,
      setIsProcessing,
      metricsHints,
    } = store;

    trackEvent("publish_start", {
      slack: slackEnabled,
      teams: teamsEnabled,
      jira: jiraEnabled,
    });
    setStep("sharing");
    setIsProcessing(true);

    try {
      const dateStr = selectedDate
        ? selectedDate.toLocaleDateString("sv-SE")
        : new Date().toLocaleDateString("sv-SE");

      const publishStart = Date.now();
      const data = await traceAsync("narada_publish", async () => {
        const res = await authedFetch("/api/updates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: dateStr,
            rawTranscript,
            slackOutput,
            teamsOutput,
            workLogEntries,
            slackEnabled,
            teamsEnabled,
            jiraEnabled,
            metricsHints,
          }),
        });
        return res.json();
      });
      const publishWallMs = Date.now() - publishStart;
      if (!data.success) {
        trackEvent("processing_error", { stage: "publish", reason: classifyError(data.error) });
        throw new Error(data.error);
      }

      const timings = data._timings ?? {};
      trackEvent("publish_complete", {
        slack: data.update.slackStatus,
        teams: data.update.teamsStatus,
        jira: data.update.jiraStatus,
        duration_ms: publishWallMs,
        total_publish_ms: typeof timings.totalPublishMs === "number" ? timings.totalPublishMs : -1,
        slack_ms: typeof timings.slackMs === "number" ? timings.slackMs : -1,
        teams_ms: typeof timings.teamsMs === "number" ? timings.teamsMs : -1,
        jira_ms: typeof timings.jiraMs === "number" ? timings.jiraMs : -1,
        platforms_succeeded: typeof timings.platformsSucceeded === "number" ? timings.platformsSucceeded : 0,
        est_time_saved_secs: typeof timings.estTimeSavedSecs === "number" ? timings.estTimeSavedSecs : 0,
      });
      setStep("editing");
      setIsProcessing(false);
      return {
        success: true,
        statuses: {
          slackStatus: data.update.slackStatus,
          teamsStatus: data.update.teamsStatus,
          jiraStatus: data.update.jiraStatus,
        },
      };
    } catch (error) {
      console.error("[Narada] Share error:", error);
      const message = error instanceof Error ? error.message : "Alas! The message could not reach the worlds. Please try again.";
      useToastStore.getState().addToast(message, "error");
      setStep("editing");
      setIsProcessing(false);
      return { success: false };
    }
  }, [store, selectedDate]);

  const retryShare = useCallback(async (): Promise<ShareResult> => {
    const {
      retryUpdateId,
      retrySlackStatus,
      retryTeamsStatus,
      retryJiraStatus,
      slackOutput,
      teamsOutput,
      workLogEntries,
      slackEnabled,
      teamsEnabled,
      jiraEnabled,
      setStep,
      setIsProcessing,
    } = store;

    if (!retryUpdateId) return { success: false };

    // Retry a platform if it's enabled AND was NOT already sent
    const retrySlack = slackEnabled && retrySlackStatus !== "SENT";
    const retryTeams = teamsEnabled && retryTeamsStatus !== "SENT";
    const retryJira = jiraEnabled && retryJiraStatus !== "SENT";

    // Nothing to retry — all platforms either succeeded or are disabled
    if (!retrySlack && !retryTeams && !retryJira) {
      useToastStore.getState().addToast("Narayan Narayan! There are no failed worlds to retry.", "success");
      return { success: false };
    }

    trackEvent("publish_retry");
    setStep("sharing");
    setIsProcessing(true);

    try {
      const res = await authedFetch("/api/updates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updateId: retryUpdateId,
          slackOutput,
          teamsOutput,
          workLogEntries,
          retrySlack,
          retryTeams,
          retryJira,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      setStep("editing");
      setIsProcessing(false);
      return {
        success: true,
        statuses: {
          slackStatus: data.update.slackStatus,
          teamsStatus: data.update.teamsStatus,
          jiraStatus: data.update.jiraStatus,
        },
      };
    } catch (error) {
      console.error("[Narada] Retry error:", error);
      const message = error instanceof Error ? error.message : "Alas! The retry could not reach the worlds. Please try again.";
      useToastStore.getState().addToast(message, "error");
      setStep("editing");
      setIsProcessing(false);
      return { success: false };
    }
  }, [store]);

  return { processWithAI, shareAll, retryShare };
}
