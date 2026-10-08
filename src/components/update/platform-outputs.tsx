"use client";

import { useUpdateStore } from "@/stores/update-store";
import { StepProcessing, MuniOrb } from "./step-processing";
import { SlackOutputCard } from "./slack-output-card";
import { TeamsOutputCard } from "./teams-output-card";
import { JiraOutputCard } from "./jira-output-card";
import { Button } from "@/components/ui/button";
import { Send, Loader2, RefreshCw } from "lucide-react";
import { jiraPublishBlocker } from "@/lib/jira-guard";

interface PlatformOutputsProps {
  activePlatforms: {
    slack: boolean;
    teams: boolean;
    jira: boolean;
  };
  onShareAll: () => void;
}

export function PlatformOutputs({
  activePlatforms,
  onShareAll,
}: PlatformOutputsProps) {
  const { previewReady, isProcessing, step, retryMode, retrySlackStatus, retryTeamsStatus, retryJiraStatus, jiraEnabled, workLogEntries } = useUpdateStore();

  const hasAnyPlatform =
    activePlatforms.slack || activePlatforms.teams || activePlatforms.jira;
  const isSharing = step === "sharing";

  // In retry mode, only show platforms that were SENT or FAILED (not SKIPPED)
  const showSlack = retryMode ? (retrySlackStatus === "SENT" || retrySlackStatus === "FAILED") : activePlatforms.slack;
  const showTeams = retryMode ? (retryTeamsStatus === "SENT" || retryTeamsStatus === "FAILED") : activePlatforms.teams;
  const showJira = retryMode ? (retryJiraStatus === "SENT" || retryJiraStatus === "FAILED") : activePlatforms.jira;

  // No platforms configured at all (only applies in normal mode)
  if (!retryMode && !hasAnyPlatform) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
          <Send className="w-7 h-7 text-narada-text-muted" />
        </div>
        <p className="text-sm text-narada-text-secondary mb-1">
          The three worlds await your call
        </p>
        <p className="text-xs text-narada-text-muted">
          Enable Slack, Teams, or Jira in Settings so Narad may carry your word
        </p>
      </div>
    );
  }

  // Not processed yet — idle orb (only in normal mode)
  if (!retryMode && !previewReady && !isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <MuniOrb />
        <p className="text-sm text-narada-text-secondary mb-1">
          Narad awaits your words
        </p>
        <p className="text-xs text-narada-text-muted">
          Write your update, then invoke the sage to prepare your scrolls
        </p>
      </div>
    );
  }

  // Processing state (only in normal mode)
  if (!retryMode && isProcessing && !previewReady) {
    return (
      <div className="flex items-center justify-center h-full">
        <StepProcessing />
      </div>
    );
  }

  // Ready — show all active platform cards
  const ButtonIcon = retryMode ? RefreshCw : Send;
  const buttonText = retryMode ? "Retry Failed Worlds" : "Dispatch to All Worlds";
  const loadingText = retryMode ? "Re-dispatching..." : "Dispatching...";
  const buttonVariant = retryMode ? "warning-soft" as const : "success" as const;
  // Same rule the server enforces; with Jira off, Slack and Teams are never blocked.
  const sendsJira = jiraEnabled && !(retryMode && retryJiraStatus === "SENT");
  const jiraBlocker = sendsJira ? jiraPublishBlocker(workLogEntries.filter((e) => !e.jiraWorklogId)) : null;

  return (
    <div className="flex flex-col gap-5">
      {showSlack && <SlackOutputCard />}
      {showTeams && <TeamsOutputCard />}
      {showJira && <JiraOutputCard />}

      {/* Share / Retry button (wrapped so the reason shows even while disabled) */}
      <div title={jiraBlocker ?? undefined}>
      <Button
        variant={buttonVariant}
        size="lg"
        onClick={onShareAll}
        disabled={isSharing || !!jiraBlocker}
        className="w-full"
      >
        {isSharing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{loadingText}</span>
          </>
        ) : (
          <>
            <ButtonIcon className="w-4 h-4" />
            <span>{buttonText}</span>
          </>
        )}
      </Button>
      {jiraBlocker && !isSharing && (
        <p className="mt-2 text-center text-xs text-narada-amber">{jiraBlocker}</p>
      )}
      </div>
    </div>
  );
}
