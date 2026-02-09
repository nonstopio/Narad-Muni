"use client";

import { useUpdateStore } from "@/stores/update-store";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { AudioVisualizer } from "./audio-visualizer";
import { Mic, Square, Loader2, Zap, RotateCcw } from "lucide-react";

interface InputPanelProps {
  onProcess: () => void;
}

export function InputPanel({ onProcess }: InputPanelProps) {
  const {
    rawTranscript,
    setRawTranscript,
    isRecording,
    recordingSeconds,
    audioBlob,
    processingError,
    isTranscribing,
    analyserNode,
    isProcessing,
    previewReady,
    setAudioBlob,
  } = useUpdateStore();
  const { toggleRecording, startRecording } = useAudioRecorder();

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleReRecord = () => {
    setRawTranscript("");
    setAudioBlob(null);
    startRecording();
  };

  const hasText = rawTranscript.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Section label */}
      <div className="text-xs font-semibold text-narada-text-secondary uppercase tracking-wider mb-4">
        Your Update
      </div>

      {/* Audio recorder row */}
      <div className="mb-4">
        {!isRecording && !isTranscribing && (
          <div className="flex items-center gap-3">
            <button
              onClick={toggleRecording}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] hover:scale-105 active:scale-95 flex-shrink-0"
            >
              <Mic className="w-4.5 h-4.5" />
            </button>
            <span className="text-sm text-narada-text-secondary">
              Record voice update
            </span>
            {audioBlob && (
              <button
                onClick={handleReRecord}
                className="ml-auto flex items-center gap-1.5 text-xs text-narada-text-muted hover:text-narada-text transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Re-record</span>
              </button>
            )}
          </div>
        )}

        {isRecording && (
          <div className="flex items-center gap-3">
            <button
              onClick={toggleRecording}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 bg-narada-rose text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] flex-shrink-0"
            >
              <Square className="w-4 h-4" fill="currentColor" />
            </button>
            <div className="font-mono text-sm font-semibold text-narada-text tabular-nums">
              {formatTime(recordingSeconds)}
            </div>
            <div className="flex-1 min-w-0">
              <AudioVisualizer analyserNode={analyserNode} compact />
            </div>
          </div>
        )}

        {isTranscribing && (
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-narada-primary animate-spin flex-shrink-0" />
            <span className="text-sm text-narada-text-secondary">
              Converting speech to text...
            </span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-xs text-narada-text-muted">or type below</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>

      {/* Textarea — always visible, fills remaining space */}
      <textarea
        className="glass-input flex-1 min-h-[180px] resize-y text-sm w-full mb-4"
        style={{ fontFamily: "var(--font-sans)" }}
        placeholder="Describe what you worked on today..."
        value={rawTranscript}
        onChange={(e) => setRawTranscript(e.target.value)}
      />

      {/* Process with AI button */}
      <button
        onClick={onProcess}
        disabled={!hasText || isProcessing}
        className="w-full h-10 rounded-xl bg-narada-primary text-white font-semibold text-[13px] shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:bg-blue-600 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            <span>{previewReady ? "Re-process" : "Process with AI"}</span>
          </>
        )}
      </button>

      {/* Error display */}
      {processingError && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-narada-rose/10 border border-narada-rose/20 text-narada-rose text-[13px]">
          {processingError}
        </div>
      )}
    </div>
  );
}
