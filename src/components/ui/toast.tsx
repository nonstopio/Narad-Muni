"use client";

import { create } from "zustand";
import { AnimatePresence, motion } from "framer-motion";
import Lottie from "lottie-react";
import muniAnimation from "@/../public/muni.json";

type ToastType = "success" | "error" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

const TOAST_STYLES = {
  success: {
    bg: "rgba(16,185,129,0.18)",
    border: "1px solid rgba(16,185,129,0.45)",
    shadow:
      "0 4px 24px rgba(0,0,0,0.6), 0 0 30px rgba(16,185,129,0.35)",
  },
  warning: {
    bg: "rgba(245,158,11,0.18)",
    border: "1px solid rgba(245,158,11,0.45)",
    shadow:
      "0 4px 24px rgba(0,0,0,0.6), 0 0 30px rgba(245,158,11,0.35)",
  },
  error: {
    bg: "rgba(239,68,68,0.18)",
    border: "1px solid rgba(239,68,68,0.45)",
    shadow:
      "0 4px 24px rgba(0,0,0,0.6), 0 0 30px rgba(239,68,68,0.35)",
  },
};

const AUTO_DISMISS_MS: Record<ToastType, number> = {
  success: 4000,
  error: 5000,
  warning: 6000,
};

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, AUTO_DISMISS_MS[type]);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const style = TOAST_STYLES[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
              style={{
                background: style.bg,
                border: style.border,
                boxShadow: style.shadow,
              }}
              className="pointer-events-auto flex items-center gap-4 px-5 py-4 rounded-2xl backdrop-blur-[20px] min-w-[420px] max-w-[520px]"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.15, 1] }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="flex-shrink-0 w-12 h-12"
              >
                <Lottie
                  animationData={muniAnimation}
                  loop
                  className="w-12 h-12"
                />
              </motion.div>
              <span className="text-sm leading-relaxed text-narada-text flex-1">
                {toast.message}
              </span>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 p-1.5 rounded-lg text-narada-text-muted hover:text-narada-text hover:bg-white/[0.08] transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M11 3L3 11M3 3l8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
