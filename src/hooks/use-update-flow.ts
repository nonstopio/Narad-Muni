"use client";

import { useCallback } from "react";
import { useUpdateStore } from "@/stores/update-store";
import { useAppStore } from "@/stores/app-store";
import { useToastStore } from "@/components/ui/toast";

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
    } = store;

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

    try {
      let transcript = rawTranscript;

      // Transcribe audio if we have a blob but no text
      if (audioBlob && !transcript) {
        setProcessingStage("transcribing");
        console.log("[Narada] Transcribing audio blob:", audioBlob.size, "bytes, type:", audioBlob.type);
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        const transcribeRes = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        const transcribeData = await transcribeRes.json();
        console.log("[Narada] Transcription response:", transcribeData);

        if (!transcribeData.success) {
          throw new Error(transcribeData.error || "Transcription failed");
        }

        transcript = transcribeData.transcript;
        setRawTranscript(transcript);
      } else {
        setProcessingStage("transcribing");
        // Brief pause so user sees transcript stage
        await new Promise((r) => setTimeout(r, 300));
      }

      // Parse with AI
      setProcessingStage("analyzing");
      const dateStr = selectedDate
        ? selectedDate.toLocaleDateString("sv-SE")
        : new Date().toLocaleDateString("sv-SE");

      const parseRes = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, date: dateStr }),
      });
      const parseData = await parseRes.json();

      if (!parseData.success) {
        throw new Error(parseData.error || "Parsing failed");
      }

      setProcessingStage("formatting");
      const { data } = parseData;
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
    } catch (error) {
      console.error("[Narada] Processing error:", error);
      const message = error instanceof Error ? error.message : "Something went wrong";
      setProcessingError(message);
      setProcessingStage(null);
      setIsProcessing(false);
    }
  }, [store, selectedDate]);

  const shareAll = useCallback(async (): Promise<boolean> => {
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
    } = store;

    setStep("sharing");
    setIsProcessing(true);

    try {
      const dateStr = selectedDate
        ? selectedDate.toLocaleDateString("sv-SE")
        : new Date().toLocaleDateString("sv-SE");

      const res = await fetch("/api/updates", {
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
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      setStep("editing");
      setIsProcessing(false);
      return true;
    } catch (error) {
      console.error("Share error:", error);
      const message = error instanceof Error ? error.message : "Alas! The message could not reach the worlds. Please try again.";
      useToastStore.getState().addToast(message, "error");
      setStep("editing");
      setIsProcessing(false);
      return false;
    }
  }, [store, selectedDate]);

  const retryShare = useCallback(async (): Promise<boolean> => {
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

    if (!retryUpdateId) return false;

    // Retry a platform if it's enabled AND was NOT already sent
    const retrySlack = slackEnabled && retrySlackStatus !== "SENT";
    const retryTeams = teamsEnabled && retryTeamsStatus !== "SENT";
    const retryJira = jiraEnabled && retryJiraStatus !== "SENT";

    // Nothing to retry — all platforms either succeeded or are disabled
    if (!retrySlack && !retryTeams && !retryJira) {
      useToastStore.getState().addToast("Narayan Narayan! There are no failed worlds to retry.", "success");
      return false;
    }

    setStep("sharing");
    setIsProcessing(true);

    try {
      const res = await fetch("/api/updates", {
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
      return true;
    } catch (error) {
      console.error("Retry error:", error);
      const message = error instanceof Error ? error.message : "Alas! The retry could not reach the worlds. Please try again.";
      useToastStore.getState().addToast(message, "error");
      setStep("editing");
      setIsProcessing(false);
      return false;
    }
  }, [store]);

  return { processWithAI, shareAll, retryShare };
}
