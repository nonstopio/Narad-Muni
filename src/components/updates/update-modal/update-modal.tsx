"use client";

import { useUpdateStore } from "@/stores/update-store";
import { useAppStore } from "@/stores/app-store";
import { useUpdateModal } from "@/hooks/use-update-modal";
import { InputPanel } from "./input-panel";
import { PreviewPanel } from "./preview-panel";
import { StepSuccess } from "./step-success";
import { AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

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
      <div className="bg-narada-surface border border-white/[0.06] rounded-2xl w-[95vw] max-w-[1200px] h-[90vh] flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex justify-between items-center flex-shrink-0">
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

        {/* Two-panel body */}
        <div className="flex flex-1 min-h-0">
          {/* Left panel — Input */}
          <div className="w-1/2 p-6 border-r border-white/[0.06] overflow-y-auto">
            <InputPanel onProcess={processWithAI} />
          </div>

          {/* Right panel — Preview */}
          <div className="w-1/2 p-6 overflow-y-auto">
            <PreviewPanel onShareAll={shareAll} />
          </div>
        </div>

        {/* Success overlay */}
        <AnimatePresence>
          {step === "success" && (
            <StepSuccess onDone={close} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
