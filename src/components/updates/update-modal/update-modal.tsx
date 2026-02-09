"use client";

import { useUpdateStore } from "@/stores/update-store";
import { useAppStore } from "@/stores/app-store";
import { useUpdateModal } from "@/hooks/use-update-modal";
import { StepInput } from "./step-input";
import { StepProcessing } from "./step-processing";
import { StepPreview } from "./step-preview";
import { StepSuccess } from "./step-success";
import { AnimatePresence, motion } from "framer-motion";
import { X, Send } from "lucide-react";

const slideTransition = {
  initial: { x: 30, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
  exit: { x: -30, opacity: 0, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
};

const scaleTransition = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
  exit: { scale: 0.95, opacity: 0, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } },
};

export function UpdateModal() {
  const { modalOpen, step, setModalOpen, reset } = useUpdateStore();
  const selectedDate = useAppStore((s) => s.selectedDate);
  const { processWithAI, shareAll } = useUpdateModal();

  if (!modalOpen) return null;

  const close = () => {
    reset();
    setModalOpen(false);
  };

  const dateTitle = selectedDate
    ? selectedDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "Create Update";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="bg-narada-surface border border-white/[0.06] rounded-2xl w-[90%] max-w-[600px] max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-6 border-b border-white/[0.06] flex justify-between items-center">
          <div className="text-xl font-semibold text-narada-text">
            {dateTitle}
          </div>
          <button
            onClick={close}
            className="text-narada-text-secondary hover:text-narada-text transition-all duration-300 bg-transparent border-none cursor-pointer p-1 rounded-lg hover:bg-white/[0.06]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {step === "input" && (
              <motion.div key="input" {...slideTransition}>
                <StepInput onProcess={processWithAI} />
              </motion.div>
            )}
            {step === "processing" && (
              <motion.div key="processing" {...slideTransition}>
                <StepProcessing />
              </motion.div>
            )}
            {step === "preview" && (
              <motion.div key="preview" {...slideTransition}>
                <StepPreview />
              </motion.div>
            )}
            {step === "success" && (
              <motion.div key="success" {...scaleTransition}>
                <StepSuccess />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-6 border-t border-white/[0.06] flex justify-end gap-3">
          {(step === "input" || step === "preview") && (
            <button
              onClick={close}
              className="h-9 px-4 rounded-xl bg-white/[0.05] border border-white/[0.06] text-narada-text-secondary text-[13px] font-semibold hover:bg-white/[0.1] hover:text-narada-text transition-all duration-300"
            >
              Cancel
            </button>
          )}
          {step === "preview" && (
            <button
              onClick={shareAll}
              className="h-9 px-4 rounded-xl bg-narada-emerald text-white text-[13px] font-semibold shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-600 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all duration-300 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Share All</span>
            </button>
          )}
          {step === "success" && (
            <button
              onClick={close}
              className="h-9 px-4 rounded-xl bg-narada-primary text-white text-[13px] font-semibold shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:bg-blue-600 transition-all duration-300"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
