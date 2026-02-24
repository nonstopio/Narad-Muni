"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type UpdateStatus = "idle" | "downloading" | "installing";

interface UpdateState {
  status: UpdateStatus;
  progress: number;
  version: string | null;
}

export function UpdateOverlay() {
  const [state, setState] = useState<UpdateState>({
    status: "idle",
    progress: 0,
    version: null,
  });

  useEffect(() => {
    const narada = (window as Window).narada;
    if (!narada?.onUpdateStatus) return;

    const cleanup = narada.onUpdateStatus(
      (_event: unknown, data: { status: string; progress?: number; version?: string }) => {
        setState({
          status: data.status as UpdateStatus,
          progress: data.progress ?? 0,
          version: data.version ?? null,
        });
      }
    );

    return cleanup;
  }, []);

  const isActive = state.status === "downloading" || state.status === "installing";

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key="update-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Backdrop — blocks all interaction */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="relative w-full max-w-md mx-4 p-8 rounded-2xl bg-narada-surface/90 border border-white/[0.06] backdrop-blur-[20px] shadow-2xl text-center"
          >
            {/* Spinner */}
            <div className="mx-auto mb-6 w-14 h-14 rounded-full border-[3px] border-white/10 border-t-narada-primary animate-[spin_1s_linear_infinite]" />

            {/* Title */}
            <h2 className="text-lg font-semibold text-narada-text mb-1">
              {state.status === "downloading"
                ? "Fetching the sacred scroll..."
                : "Applying the sacred update..."}
            </h2>

            {/* Version */}
            {state.version && (
              <p className="text-sm text-narada-text-muted mb-5">
                v{state.version}
              </p>
            )}

            {/* Progress bar — only for downloading */}
            {state.status === "downloading" && (
              <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden mb-3">
                <motion.div
                  className="h-full rounded-full bg-narada-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${state.progress}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>
            )}

            {/* Status text */}
            <p className="text-xs text-narada-text-muted">
              {state.status === "downloading"
                ? `${state.progress}% complete`
                : "The sage must briefly retire... do not close the app."}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
