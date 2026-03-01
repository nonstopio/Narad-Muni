"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Narada Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center">
      <div className="max-w-[560px] w-full">
        <div className="glass-card p-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-narada-rose/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-narada-rose" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-narada-text">
                Alas! A Disturbance in the Cosmos
              </h2>
              <p className="text-sm text-narada-text-secondary mt-0.5">
                The sage encountered a rift while traversing this realm.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-narada-rose/5 border border-narada-rose/20 px-4 py-3">
            <p className="text-sm font-medium text-narada-rose">
              {error.message || "An unknown disturbance occurred"}
            </p>
            {error.digest && (
              <p className="text-xs text-narada-text-muted mt-1 font-mono">
                Digest: {error.digest}
              </p>
            )}
          </div>

          {error.stack && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-narada-text-muted uppercase tracking-wider">
                Sacred Stack Trace
              </span>
              <pre className="text-xs font-mono text-narada-text-secondary bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 overflow-x-auto overflow-y-auto max-h-[200px] whitespace-pre-wrap break-words select-all">
                {error.stack}
              </pre>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              variant="danger-soft"
              size="lg"
              onClick={() => reset()}
              className="flex-1"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                try {
                  sessionStorage.setItem(
                    "narada-error-context",
                    JSON.stringify({
                      title: error.message || "Unknown error",
                      description: error.stack || "",
                    })
                  );
                } catch {
                  // sessionStorage may be unavailable
                }
                window.location.href = "/report";
              }}
            >
              <Bug className="w-4 h-4" />
              Seek Aid
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
