import { create } from "zustand";
import type { ModalStep, ProcessingStage, WorkLogEntryData } from "@/types";

interface UpdateStore {
  modalOpen: boolean;
  step: ModalStep;
  rawTranscript: string;
  isRecording: boolean;
  recordingSeconds: number;
  audioBlob: Blob | null;
  slackOutput: string;
  teamsOutput: string;
  workLogEntries: WorkLogEntryData[];
  slackEnabled: boolean;
  teamsEnabled: boolean;
  jiraEnabled: boolean;
  processingError: string | null;
  isTranscribing: boolean;
  processingStage: ProcessingStage | null;
  analyserNode: AnalyserNode | null;
  previewReady: boolean;
  isProcessing: boolean;

  setModalOpen: (open: boolean) => void;
  setStep: (step: ModalStep) => void;
  setRawTranscript: (text: string) => void;
  setIsRecording: (recording: boolean) => void;
  setRecordingSeconds: (seconds: number) => void;
  setAudioBlob: (blob: Blob | null) => void;
  setSlackOutput: (output: string) => void;
  setTeamsOutput: (output: string) => void;
  setWorkLogEntries: (entries: WorkLogEntryData[]) => void;
  togglePlatform: (platform: "slack" | "teams" | "jira") => void;
  setProcessingError: (error: string | null) => void;
  setIsTranscribing: (transcribing: boolean) => void;
  setProcessingStage: (stage: ProcessingStage | null) => void;
  setAnalyserNode: (node: AnalyserNode | null) => void;
  setPreviewReady: (ready: boolean) => void;
  setIsProcessing: (processing: boolean) => void;
  reset: () => void;
}

const initialState = {
  modalOpen: false,
  step: "editing" as ModalStep,
  rawTranscript: "",
  isRecording: false,
  recordingSeconds: 0,
  audioBlob: null as Blob | null,
  slackOutput: "",
  teamsOutput: "",
  workLogEntries: [] as WorkLogEntryData[],
  slackEnabled: true,
  teamsEnabled: true,
  jiraEnabled: true,
  processingError: null as string | null,
  isTranscribing: false,
  processingStage: null as ProcessingStage | null,
  analyserNode: null as AnalyserNode | null,
  previewReady: false,
  isProcessing: false,
};

export const useUpdateStore = create<UpdateStore>((set) => ({
  ...initialState,
  setModalOpen: (open) => set({ modalOpen: open }),
  setStep: (step) => set({ step }),
  setRawTranscript: (text) => set({ rawTranscript: text }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  setRecordingSeconds: (seconds) => set({ recordingSeconds: seconds }),
  setAudioBlob: (blob) => set({ audioBlob: blob }),
  setSlackOutput: (output) => set({ slackOutput: output }),
  setTeamsOutput: (output) => set({ teamsOutput: output }),
  setWorkLogEntries: (entries) => set({ workLogEntries: entries }),
  togglePlatform: (platform) =>
    set((state) => {
      if (platform === "slack") return { slackEnabled: !state.slackEnabled };
      if (platform === "teams") return { teamsEnabled: !state.teamsEnabled };
      return { jiraEnabled: !state.jiraEnabled };
    }),
  setProcessingError: (error) => set({ processingError: error }),
  setIsTranscribing: (transcribing) => set({ isTranscribing: transcribing }),
  setProcessingStage: (stage) => set({ processingStage: stage }),
  setAnalyserNode: (node) => set({ analyserNode: node }),
  setPreviewReady: (ready) => set({ previewReady: ready }),
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  reset: () => set(initialState),
}));
