"use client";

import { useState } from "react";
import { useUpdateStore } from "@/stores/update-store";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { AudioVisualizer } from "./audio-visualizer";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, Square, Loader2, RotateCcw, Zap, ChevronDown } from "lucide-react";

interface StepInputProps {
  onProcess: () => void;
}

type InputState = "idle" | "recording" | "transcribing" | "ready";

const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] } },
};

export function StepInput({ onProcess }: StepInputProps) {
  const {
    rawTranscript,
    setRawTranscript,
    isRecording,
    recordingSeconds,
    audioBlob,
    processingError,
    isTranscribing,
    analyserNode,
    setAudioBlob,
  } = useUpdateStore();
  const { toggleRecording, startRecording } = useAudioRecorder();
  const [textEditorOpen, setTextEditorOpen] = useState(false);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Determine current visual state
  const getState = (): InputState => {
    if (isRecording) return "recording";
    if (isTranscribing) return "transcribing";
    if (rawTranscript.trim()) return "ready";
    return "idle";
  };

  const state = getState();

  const handleReRecord = () => {
    setRawTranscript("");
    setAudioBlob(null);
    startRecording();
  };

  return (
    <div>
      <AnimatePresence mode="wait">
        {/* IDLE STATE */}
        {state === "idle" && (
          <motion.div key="idle" {...fadeSlide} className="flex flex-col items-center">
            {/* Hero mic button */}
            <div className="relative mb-5">
              {/* Gradient ring */}
              <div
                className="absolute inset-0 rounded-full animate-pulse"
                style={{
                  background: "linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(239, 68, 68, 0.1))",
                  filter: "blur(8px)",
                  transform: "scale(1.3)",
                }}
              />
              <button
                onClick={toggleRecording}
                className="relative w-[68px] h-[68px] rounded-full flex items-center justify-center transition-all duration-300 bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)] hover:shadow-[0_0_40px_rgba(239,68,68,0.6)] hover:scale-105 active:scale-95"
              >
                <Mic className="w-7 h-7" />
              </button>
            </div>

            <p className="text-sm text-narada-text-secondary mb-6">
              Tap to start recording
            </p>

            {/* Divider */}
            <div className="flex items-center gap-3 w-full mb-4">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-xs text-narada-text-muted">or type your update</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Collapsible text editor */}
            <button
              onClick={() => setTextEditorOpen(!textEditorOpen)}
              className="flex items-center gap-2 text-xs text-narada-text-secondary hover:text-narada-text transition-colors mb-3"
            >
              <span>Open text editor</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${textEditorOpen ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {textEditorOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full overflow-hidden"
                >
                  <textarea
                    className="glass-input min-h-[120px] resize-y text-sm w-full mb-4"
                    style={{ fontFamily: "var(--font-sans)" }}
                    placeholder="What did you accomplish today? Describe your work in detail..."
                    value={rawTranscript}
                    onChange={(e) => setRawTranscript(e.target.value)}
                  />
                  {rawTranscript.trim() && (
                    <button
                      onClick={onProcess}
                      className="w-full h-10 rounded-xl bg-narada-primary text-white font-semibold text-[13px] shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:bg-blue-600 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Process with AI</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {processingError && (
              <div className="w-full mt-4 px-3 py-2 rounded-lg bg-narada-rose/10 border border-narada-rose/20 text-narada-rose text-[13px]">
                {processingError}
              </div>
            )}
          </motion.div>
        )}

        {/* RECORDING STATE */}
        {state === "recording" && (
          <motion.div key="recording" {...fadeSlide} className="flex flex-col items-center">
            {/* Stop button with pulsing rings */}
            <div className="relative mb-5">
              {/* Outer ping ring */}
              <div className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" style={{ animationDuration: "2s" }} />
              {/* Inner ping ring */}
              <div className="absolute inset-[-4px] rounded-full bg-rose-500/20 animate-ping" style={{ animationDuration: "1.5s" }} />
              <button
                onClick={toggleRecording}
                className="relative w-[68px] h-[68px] rounded-full flex items-center justify-center transition-all duration-300 bg-narada-rose text-white shadow-[0_0_30px_rgba(239,68,68,0.5)]"
              >
                <Square className="w-6 h-6" fill="currentColor" />
              </button>
            </div>

            {/* Timer */}
            <div className="text-3xl font-mono font-semibold text-narada-text mb-4 tabular-nums">
              {formatTime(recordingSeconds)}
            </div>

            {/* Audio visualizer */}
            <div className="w-full mb-4">
              <AudioVisualizer analyserNode={analyserNode} />
            </div>

            <p className="text-sm text-narada-text-secondary">
              Recording... Tap to stop
            </p>
          </motion.div>
        )}

        {/* TRANSCRIBING STATE */}
        {state === "transcribing" && (
          <motion.div key="transcribing" {...fadeSlide} className="flex flex-col items-center py-4">
            <Loader2 className="w-10 h-10 text-narada-primary animate-spin mb-4" />
            <p className="text-sm font-medium text-narada-text-secondary mb-6">
              Converting speech to text...
            </p>

            {/* Skeleton shimmer lines */}
            <div className="w-full space-y-3">
              {[1, 0.85, 0.7, 0.9].map((width, i) => (
                <div
                  key={i}
                  className="h-3 rounded-full overflow-hidden"
                  style={{ width: `${width * 100}%` }}
                >
                  <div
                    className="h-full w-full rounded-full"
                    style={{
                      background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 1.5s infinite",
                    }}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* READY STATE */}
        {state === "ready" && (
          <motion.div key="ready" {...fadeSlide}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-narada-text-secondary uppercase tracking-wider">
                Transcript
              </span>
              <button
                onClick={handleReRecord}
                className="flex items-center gap-1.5 text-xs text-narada-text-muted hover:text-narada-text transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Record again</span>
              </button>
            </div>

            <textarea
              className="glass-input min-h-[150px] resize-y text-sm w-full mb-5"
              style={{ fontFamily: "var(--font-sans)" }}
              value={rawTranscript}
              onChange={(e) => setRawTranscript(e.target.value)}
            />

            {processingError && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-narada-rose/10 border border-narada-rose/20 text-narada-rose text-[13px]">
                {processingError}
              </div>
            )}

            <button
              onClick={onProcess}
              disabled={!rawTranscript.trim() && !audioBlob}
              className="w-full h-10 rounded-xl bg-narada-primary text-white font-semibold text-[13px] shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:bg-blue-600 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>Process with AI</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
