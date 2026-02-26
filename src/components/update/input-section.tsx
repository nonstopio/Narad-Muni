"use client";

import { useEffect, useState } from "react";
import { useUpdateStore } from "@/stores/update-store";
import { useToastStore } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { AudioVisualizer } from "./audio-visualizer";
import { Mic, Square, Loader2, Zap, RotateCcw } from "lucide-react";

interface InputSectionProps {
  onProcess: () => void;
}

export function InputSection({ onProcess }: InputSectionProps) {
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

  const [hasDeepgramKey, setHasDeepgramKey] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/settings/ai-provider")
      .then((r) => r.json())
      .then((data) => setHasDeepgramKey(!!data.hasDeepgramKey))
      .catch(() => setHasDeepgramKey(false));
  }, []);

  // Register onToggleRecording callback for keyboard shortcut
  useEffect(() => {
    const { setOnToggleRecording } = useUpdateStore.getState();
    setOnToggleRecording(() => {
      if (hasDeepgramKey === false) {
        useToastStore.getState().addToast("Grant me the Deepgram mantra in Sacred Configurations to hear your voice", "error");
        return;
      }
      if (hasDeepgramKey === null) return;
      if (useUpdateStore.getState().isTranscribing) {
        useToastStore.getState().addToast("Patience! I am still transcribing your words...", "error");
        return;
      }
      if (useUpdateStore.getState().isProcessing) {
        useToastStore.getState().addToast("The sage is channeling! Wait for the oracle to finish...", "error");
        return;
      }
      toggleRecording();
    });
    return () => useUpdateStore.getState().setOnToggleRecording(null);
  }, [hasDeepgramKey, toggleRecording]);

  // Consume autoStartRecording flag (set by keyboard shortcut from another page)
  useEffect(() => {
    if (hasDeepgramKey === null) return;
    const { autoStartRecording, setAutoStartRecording } = useUpdateStore.getState();
    if (!autoStartRecording) return;
    setAutoStartRecording(false);
    if (hasDeepgramKey === false) {
      useToastStore.getState().addToast("Grant me the Deepgram mantra in Sacred Configurations to hear your voice", "error");
      return;
    }
    setTimeout(() => startRecording(), 100);
  }, [hasDeepgramKey, startRecording]);

  const deepgramDisabled = hasDeepgramKey === false;

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
    <div className="flex flex-col h-full pb-6">
      {/* Section label */}
      <div className="text-xs font-semibold text-narada-text-secondary uppercase tracking-wider mb-4">
        Your Words
      </div>

      {/* Textarea — at top, fills available space */}
      <textarea
        className="glass-input flex-1 min-h-[240px] resize-y text-sm w-full mb-4"
        style={{ fontFamily: "var(--font-sans)" }}
        placeholder={"What deeds did you accomplish today?\nWhat task calls to you next?\nWhat plans do you hold for tomorrow?\nAny obstacles on the path?"}
        value={rawTranscript}
        onChange={(e) => setRawTranscript(e.target.value)}
      />

      {/* Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-xs text-narada-text-muted">or speak your truth below</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>

      {/* Audio recorder row — fixed height so layout doesn't shift between states */}
      <div className="h-10 mb-4">
        {!isRecording && !isTranscribing && (
          <div className="flex items-center gap-3">
            <button
              onClick={toggleRecording}
              disabled={deepgramDisabled}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
                deepgramDisabled
                  ? "bg-white/[0.06] text-narada-text-muted cursor-not-allowed"
                  : "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] hover:scale-105 active:scale-95"
              }`}
            >
              <Mic className="w-4.5 h-4.5" />
            </button>
            <span className="text-sm text-narada-text-secondary">
              {deepgramDisabled ? "Grant me the Deepgram mantra in Sacred Configurations to hear your voice" : "Speak your update"}
            </span>
            {audioBlob && (
              <Button
                variant="ghost"
                size="xs"
                onClick={handleReRecord}
                className="ml-auto text-narada-text-muted"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Speak again</span>
              </Button>
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
              Transcribing your voice... Narad is listening...
            </span>
          </div>
        )}
      </div>

      {/* Process with AI button */}
      <Button
        variant="primary"
        size="lg"
        onClick={onProcess}
        disabled={!hasText || isProcessing}
        className="w-full"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Channeling...</span>
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            <span>{previewReady ? "Consult Again" : "Invoke the Sage"}</span>
          </>
        )}
      </Button>

      {/* Error display */}
      {processingError && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-narada-rose/10 border border-narada-rose/20 text-narada-rose text-[13px]">
          {processingError}
        </div>
      )}
    </div>
  );
}
