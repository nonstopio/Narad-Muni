"use client";

import { useEffect, useState } from "react";
import { useUpdateStore } from "@/stores/update-store";
import { useSettingsStore } from "@/stores/settings-store";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, Circle } from "lucide-react";
import type { ProcessingStage } from "@/types";

const PROVIDER_LABELS: Record<string, string> = {
  "local-claude": "Local Claude CLI",
  "gemini": "Gemini AI",
  "claude-api": "Claude API",
};

const stages: { key: ProcessingStage; label: string }[] = [
  { key: "transcribing", label: "Listening to your words" },
  { key: "analyzing", label: "Seeking divine insight" },
  { key: "formatting", label: "Crafting scrolls for three worlds" },
];

const tips = [
  "Narad listens closely... gathering your deeds and accomplishments...",
  "Counting the hours of your devotion, noting each sacred ticket...",
  "Inscribing separate scrolls for each of the three worlds...",
  "Sensing obstacles on the path... every sage knows where the thorns lie...",
  "Arranging the chronicle of your day with care and precision...",
];

function getStageIndex(stage: ProcessingStage | null): number {
  if (!stage) return -1;
  return stages.findIndex((s) => s.key === stage);
}

function getProgressPercent(stage: ProcessingStage | null): number {
  switch (stage) {
    case "transcribing": return 15;
    case "analyzing": return 55;
    case "formatting": return 90;
    default: return 0;
  }
}

export function StepProcessing() {
  const processingStage = useUpdateStore((s) => s.processingStage);
  const aiProvider = useSettingsStore((s) => s.aiSettings.aiProvider);
  const label = PROVIDER_LABELS[aiProvider] ?? "AI";

  const [tipIndex, setTipIndex] = useState(0);
  const activeIndex = getStageIndex(processingStage);
  const progress = getProgressPercent(processingStage);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-6">
      {/* Pipeline stages */}
      <div className="w-full max-w-sm space-y-4">
        {stages.map((stage, i) => {
          const isCompleted = i < activeIndex;
          const isActive = i === activeIndex;
          const isPending = i > activeIndex;

          return (
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="flex items-center gap-3"
            >
              {/* Status icon */}
              <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                {isCompleted && (
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-narada-emerald" />
                  </div>
                )}
                {isActive && (
                  <Loader2 className="w-5 h-5 text-narada-primary animate-spin" />
                )}
                {isPending && (
                  <Circle className="w-5 h-5 text-narada-text-muted" />
                )}
              </div>

              {/* Label */}
              <span
                className={`text-sm font-medium transition-colors duration-300 ${
                  isCompleted
                    ? "text-narada-emerald"
                    : isActive
                    ? "text-narada-text"
                    : "text-narada-text-muted"
                }`}
              >
                {stage.label}
                {isActive && stage.key === "analyzing" && `  (${label})`}
                {isActive && "..."}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: "linear-gradient(90deg, #3B82F6, #8B5CF6)",
          }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
      </div>

      {/* Rotating tips */}
      <div className="h-5 relative w-full max-w-sm">
        <AnimatePresence mode="wait">
          <motion.p
            key={tipIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "linear" }}
            className="text-xs text-narada-text-muted text-center absolute inset-0"
          >
            {tips[tipIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
