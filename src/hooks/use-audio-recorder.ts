"use client";

import { useRef, useCallback, useEffect } from "react";
import { useUpdateStore } from "@/stores/update-store";

export function useAudioRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const {
    isRecording,
    setIsRecording,
    setRecordingSeconds,
    setAudioBlob,
    setRawTranscript,
    setIsTranscribing,
    setProcessingError,
    setAnalyserNode,
  } = useUpdateStore();

  const startRecording = useCallback(async () => {
    try {
      console.log("[Narada] Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("[Narada] Microphone access granted");

      // Create AudioContext and AnalyserNode for visualization
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      // Don't connect to destination — no feedback
      audioContextRef.current = audioContext;
      setAnalyserNode(analyser);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          console.log("[Narada] Audio chunk received:", e.data.size, "bytes (total chunks:", chunksRef.current.length + ")");
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("[Narada] Recording stopped, processing", chunksRef.current.length, "chunks");
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        console.log("[Narada] Audio blob created:", blob.size, "bytes");
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());

        // Cleanup audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        setAnalyserNode(null);

        // Auto-transcribe and fill the textarea
        setIsTranscribing(true);
        setProcessingError(null);
        try {
          console.log("[Narada] Auto-transcribing audio:", blob.size, "bytes");
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          console.log("[Narada] Transcription result:", data);
          if (data.success && data.transcript) {
            console.log("[Narada] Transcript received:", data.transcript.substring(0, 100) + (data.transcript.length > 100 ? "..." : ""));
            const current = useUpdateStore.getState().rawTranscript;
            setRawTranscript(current ? current + " " + data.transcript : data.transcript);
          } else {
            setProcessingError(data.error || "Transcription failed");
          }
        } catch (err) {
          console.error("[Narada] Transcription error:", err);
          setProcessingError(err instanceof Error ? err.message : "Transcription failed");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(1000);
      console.log("[Narada] Recording started");
      setIsRecording(true);
      setRecordingSeconds(0);
      setProcessingError(null);

      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds++;
        setRecordingSeconds(seconds);
      }, 1000);
    } catch (err) {
      console.error("[Narada] Microphone permission denied:", err);
    }
  }, [setIsRecording, setRecordingSeconds, setAudioBlob, setRawTranscript, setIsTranscribing, setProcessingError, setAnalyserNode]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }, [setIsRecording]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  return { toggleRecording, startRecording, stopRecording };
}
