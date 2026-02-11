"use client";

import { useUpdateStore } from "@/stores/update-store";
import { StepProcessing } from "./step-processing";
import { SlackOutputCard } from "./slack-output-card";
import { TeamsOutputCard } from "./teams-output-card";
import { JiraOutputCard } from "./jira-output-card";
import { Send, Loader2 } from "lucide-react";

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
  const { previewReady, isProcessing, step } = useUpdateStore();

  const hasAnyPlatform =
    activePlatforms.slack || activePlatforms.teams || activePlatforms.jira;
  const isSharing = step === "sharing";

  // No platforms configured at all
  if (!hasAnyPlatform) {
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

  // Not processed yet — empty state
  if (!previewReady && !isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
          <Loader2 className="w-7 h-7 text-narada-text-muted" />
        </div>
        <p className="text-sm text-narada-text-secondary mb-1">
          Narad awaits your words
        </p>
        <p className="text-xs text-narada-text-muted">
          Speak or write your update, then invoke the sage to prepare your scrolls
        </p>
      </div>
    );
  }

  // Processing state
  if (isProcessing && !previewReady) {
    return (
      <div className="flex items-center justify-center h-full">
        <StepProcessing />
      </div>
    );
  }

  // Ready — show all active platform cards
  return (
    <div className="flex flex-col gap-5">
      {activePlatforms.slack && <SlackOutputCard />}
      {activePlatforms.teams && <TeamsOutputCard />}
      {activePlatforms.jira && <JiraOutputCard />}

      {/* Share All button */}
      <button
        onClick={onShareAll}
        disabled={isSharing}
        className="w-full h-10 rounded-xl bg-narada-emerald text-white font-semibold text-[13px] shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-600 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSharing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Dispatching...</span>
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            <span>Dispatch to All Worlds</span>
          </>
        )}
      </button>
    </div>
  );
}
