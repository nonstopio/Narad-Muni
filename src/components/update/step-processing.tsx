"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useUpdateStore } from "@/stores/update-store";
import { useSettingsStore } from "@/stores/settings-store";
import { motion } from "framer-motion";
import Lottie from "lottie-react";
import muniAnimation from "@/../public/muni.json";
import type { ProcessingStage } from "@/types";

const PROVIDER_LABELS: Record<string, string> = {
  "local-claude": "Local Claude CLI",
  "local-cursor": "Local Cursor CLI",
  "gemini": "Gemini AI",
  "claude-api": "Claude API",
};

const STAGE_LABELS: Record<ProcessingStage, string> = {
  transcribing: "Listening to your sacred words",
  analyzing: "Seeking divine insight",
  formatting: "Crafting scrolls for three worlds",
};

const STAGE_ORDER: ProcessingStage[] = ["transcribing", "analyzing", "formatting"];

const STAGE_MESSAGES: Record<ProcessingStage, string[]> = {
  transcribing: [
    "Listening to your sacred words...",
    "The sage hears all that is spoken...",
  ],
  analyzing: [
    "Parsing your narration...",
    "Detecting tasks and sacred tickets...",
    "Weighing time across each endeavor...",
    "Ensuring 8 hours of devotion are honored...",
    "Identifying blockers on the path...",
    "The oracle contemplates deeply...",
  ],
  formatting: [
    "Inscribing scrolls for Slack...",
    "Crafting the Teams chronicle...",
    "Preparing Jira work log entries...",
  ],
};

function getStageIndex(stage: ProcessingStage | null): number {
  if (!stage) return -1;
  return STAGE_ORDER.indexOf(stage);
}

function getProgressPercent(stage: ProcessingStage | null): number {
  switch (stage) {
    case "transcribing": return 15;
    case "analyzing": return 55;
    case "formatting": return 90;
    default: return 0;
  }
}

/** Shared Muni orb — idle (still) or processing (pulsing) */
export function MuniOrb({ active = false }: { active?: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: active ? [1, 1.12, 1] : 1,
        opacity: 1,
      }}
      transition={
        active
          ? { scale: { duration: 2.5, ease: "easeInOut", repeat: Infinity }, opacity: { duration: 0.6 } }
          : { duration: 0.6, ease: [0.4, 0, 0.2, 1] }
      }
      className="w-[220px] h-[220px]"
    >
      <Lottie
        animationData={muniAnimation}
        loop
        className="w-full h-full"
      />
    </motion.div>
  );
}

/** Typewriter message component */
function TypewriterMessage({ text, onDone }: { text: string; onDone: () => void }) {
  const [charIndex, setCharIndex] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (charIndex < text.length) {
      const timer = setTimeout(() => setCharIndex((i) => i + 1), 30);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => onDoneRef.current(), 500);
      return () => clearTimeout(timer);
    }
  }, [charIndex, text.length]);

  return (
    <div className="font-mono text-xs text-narada-text-secondary leading-relaxed whitespace-pre-wrap">
      <span className="text-narada-text-muted mr-1.5">&gt;</span>
      {text.slice(0, charIndex)}
      {charIndex < text.length && (
        <span className="animate-blink text-narada-primary">&#9612;</span>
      )}
    </div>
  );
}

export function StepProcessing() {
  const processingStage = useUpdateStore((s) => s.processingStage);
  const aiProvider = useSettingsStore((s) => s.aiSettings.aiProvider);
  const label = PROVIDER_LABELS[aiProvider] ?? "AI";

  const activeIndex = getStageIndex(processingStage);
  const progress = getProgressPercent(processingStage);

  // Thought stream state
  const [messages, setMessages] = useState<string[]>([]);
  const [currentMsgIndex, setCurrentMsgIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevStageRef = useRef<ProcessingStage | null>(null);

  // Reset messages when stage changes
  useEffect(() => {
    if (processingStage && processingStage !== prevStageRef.current) {
      prevStageRef.current = processingStage;
      setMessages([]);
      setCurrentMsgIndex(0);
      setIsTyping(true);
    }
  }, [processingStage]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleMessageDone = useCallback(() => {
    if (!processingStage) return;
    const pool = STAGE_MESSAGES[processingStage];

    setMessages((prev) => {
      const msg = pool[currentMsgIndex % pool.length];
      if (prev[prev.length - 1] === msg) return prev;
      return [...prev, msg];
    });

    setCurrentMsgIndex((prev) => prev + 1);
    setIsTyping(true);
  }, [processingStage, currentMsgIndex]);

  const currentPool = processingStage ? STAGE_MESSAGES[processingStage] : [];
  const currentText = currentPool[currentMsgIndex % currentPool.length] ?? "";

  return (
    <div className="flex flex-col items-center justify-center gap-5">
      {/* Pulsing Muni Orb */}
      <MuniOrb active />

      {/* Stage label + provider */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="text-center"
      >
        <p className="text-sm font-medium text-narada-text">
          {processingStage ? STAGE_LABELS[processingStage] : "Preparing"}
          {processingStage === "analyzing" && ` (${label})`}...
        </p>
      </motion.div>

      {/* Compact stage dots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-2"
      >
        {STAGE_ORDER.map((stage, i) => {
          const isCompleted = i < activeIndex;
          const isActive = i === activeIndex;
          return (
            <div
              key={stage}
              className={`w-2 h-2 rounded-full transition-all duration-500 ${
                isCompleted
                  ? "bg-narada-emerald"
                  : isActive
                  ? "bg-narada-primary scale-125"
                  : "bg-white/20"
              }`}
            />
          );
        })}
      </motion.div>

      {/* Thought stream */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="glass-card w-[280px] h-[140px] overflow-hidden p-3 flex flex-col"
        style={{ borderRadius: "12px" }}
      >
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1.5 scrollbar-none">
          {messages.map((msg, i) => (
            <div
              key={`${i}-${msg}`}
              className="font-mono text-xs text-narada-text-muted leading-relaxed whitespace-pre-wrap"
              style={{
                opacity: Math.max(0.3, 1 - (messages.length - i) * 0.15),
              }}
            >
              <span className="mr-1.5">&gt;</span>
              {msg}
            </div>
          ))}
          {isTyping && processingStage && (
            <TypewriterMessage
              key={`typing-${currentMsgIndex}-${processingStage}`}
              text={currentText}
              onDone={handleMessageDone}
            />
          )}
        </div>
      </motion.div>

      {/* Progress bar */}
      <div className="w-[280px] h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: "linear-gradient(90deg, #3B82F6, #8B5CF6)",
          }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}
