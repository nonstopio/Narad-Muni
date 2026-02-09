"use client";

import { useUpdateStore } from "@/stores/update-store";
import { motion } from "framer-motion";
import { CheckCircle, MessageSquare, Users, ClipboardList } from "lucide-react";

const platformIcons: Record<string, React.ReactNode> = {
  Slack: <MessageSquare className="w-3.5 h-3.5" />,
  Teams: <Users className="w-3.5 h-3.5" />,
  Jira: <ClipboardList className="w-3.5 h-3.5" />,
};

interface StepSuccessProps {
  onDone: () => void;
}

export function StepSuccess({ onDone }: StepSuccessProps) {
  const { slackEnabled, teamsEnabled, jiraEnabled } = useUpdateStore();

  const results = [
    { label: "Slack", enabled: slackEnabled },
    { label: "Teams", enabled: teamsEnabled },
    { label: "Jira", enabled: jiraEnabled },
  ].filter((r) => r.enabled);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl"
      style={{ background: "rgba(10, 10, 15, 0.85)", backdropFilter: "blur(8px)" }}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Checkmark with spring bounce */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            duration: 0.5,
            ease: [0.34, 1.56, 0.64, 1],
          }}
          className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center"
        >
          <CheckCircle className="w-10 h-10 text-narada-emerald" />
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="text-xl font-semibold text-narada-text"
        >
          All Updates Published!
        </motion.div>

        {/* Platform badges */}
        <div className="flex gap-3 justify-center flex-wrap">
          {results.map((r, i) => (
            <motion.div
              key={r.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.5 + i * 0.12,
                duration: 0.35,
                ease: [0.4, 0, 0.2, 1],
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-3xl text-xs font-medium text-narada-emerald"
            >
              {platformIcons[r.label]}
              <span>{r.label}</span>
            </motion.div>
          ))}
        </div>

        {/* Done button */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          onClick={onDone}
          className="mt-2 h-9 px-6 rounded-xl bg-narada-primary text-white text-[13px] font-semibold shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:bg-blue-600 transition-all duration-300"
        >
          Done
        </motion.button>
      </div>
    </motion.div>
  );
}
