import { create } from "zustand";
import type { ModalStep, ProcessingStage, WorkLogEntryData, PlatformConfigData, PublishStatus } from "@/types";

interface UpdateStore {
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

  // Retry mode
  retryMode: boolean;
  retryUpdateId: string | null;
  retrySlackStatus: PublishStatus | null;
  retryTeamsStatus: PublishStatus | null;
  retryJiraStatus: PublishStatus | null;

  setStep: (step: ModalStep) => void;
  setRawTranscript: (text: string) => void;
  setIsRecording: (recording: boolean) => void;
  setRecordingSeconds: (seconds: number) => void;
  setAudioBlob: (blob: Blob | null) => void;
  setSlackOutput: (output: string) => void;
  setTeamsOutput: (output: string) => void;
  setWorkLogEntries: (entries: WorkLogEntryData[]) => void;
  updateWorkLogEntry: (index: number, patch: Partial<WorkLogEntryData>) => void;
  addWorkLogEntry: (entry: WorkLogEntryData) => void;
  removeWorkLogEntry: (index: number) => void;
  togglePlatform: (platform: "slack" | "teams" | "jira") => void;
  setProcessingError: (error: string | null) => void;
  setIsTranscribing: (transcribing: boolean) => void;
  setProcessingStage: (stage: ProcessingStage | null) => void;
  setAnalyserNode: (node: AnalyserNode | null) => void;
  setPreviewReady: (ready: boolean) => void;
  setIsProcessing: (processing: boolean) => void;
  onInvokeSage: (() => void) | null;
  onDispatch: (() => void) | null;
  setOnInvokeSage: (cb: (() => void) | null) => void;
  setOnDispatch: (cb: (() => void) | null) => void;
  setRetryMode: (mode: boolean) => void;
  setRetryUpdateId: (id: string | null) => void;
  setRetryStatuses: (slack: PublishStatus | null, teams: PublishStatus | null, jira: PublishStatus | null) => void;
  initPlatformToggles: (configs: PlatformConfigData[]) => void;
  resetForNewUpdate: () => void;
  reset: () => void;
}

const initialState = {
  step: "editing" as ModalStep,
  rawTranscript: "",
  isRecording: false,
  recordingSeconds: 0,
  audioBlob: null as Blob | null,
  slackOutput: "",
  teamsOutput: "",
  workLogEntries: [] as WorkLogEntryData[],
  slackEnabled: false,
  teamsEnabled: false,
  jiraEnabled: false,
  processingError: null as string | null,
  isTranscribing: false,
  processingStage: null as ProcessingStage | null,
  analyserNode: null as AnalyserNode | null,
  previewReady: false,
  isProcessing: false,
  onInvokeSage: null as (() => void) | null,
  onDispatch: null as (() => void) | null,
  retryMode: false,
  retryUpdateId: null as string | null,
  retrySlackStatus: null as PublishStatus | null,
  retryTeamsStatus: null as PublishStatus | null,
  retryJiraStatus: null as PublishStatus | null,
};

export const useUpdateStore = create<UpdateStore>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setRawTranscript: (text) => set({ rawTranscript: text }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  setRecordingSeconds: (seconds) => set({ recordingSeconds: seconds }),
  setAudioBlob: (blob) => set({ audioBlob: blob }),
  setSlackOutput: (output) => set({ slackOutput: output }),
  setTeamsOutput: (output) => set({ teamsOutput: output }),
  setWorkLogEntries: (entries) => set({ workLogEntries: entries }),
  updateWorkLogEntry: (index, patch) =>
    set((state) => ({
      workLogEntries: state.workLogEntries.map((e, i) =>
        i === index ? { ...e, ...patch } : e
      ),
    })),
  addWorkLogEntry: (entry) =>
    set((state) => ({ workLogEntries: [...state.workLogEntries, entry] })),
  removeWorkLogEntry: (index) =>
    set((state) => ({
      workLogEntries: state.workLogEntries.filter((_, i) => i !== index),
    })),
  togglePlatform: (platform) =>
    set((state) => {
      // In retry mode, prevent toggling platforms that already succeeded or were skipped
      if (state.retryMode) {
        if (platform === "slack" && (state.retrySlackStatus === "SENT" || state.retrySlackStatus === "SKIPPED")) return {};
        if (platform === "teams" && (state.retryTeamsStatus === "SENT" || state.retryTeamsStatus === "SKIPPED")) return {};
        if (platform === "jira" && (state.retryJiraStatus === "SENT" || state.retryJiraStatus === "SKIPPED")) return {};
      }
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
  setOnInvokeSage: (cb) => set({ onInvokeSage: cb }),
  setOnDispatch: (cb) => set({ onDispatch: cb }),
  setRetryMode: (mode) => set({ retryMode: mode }),
  setRetryUpdateId: (id) => set({ retryUpdateId: id }),
  setRetryStatuses: (slack, teams, jira) =>
    set({ retrySlackStatus: slack, retryTeamsStatus: teams, retryJiraStatus: jira }),
  initPlatformToggles: (configs) =>
    set({
      slackEnabled: configs.find((c) => c.platform === "SLACK")?.isActive ?? false,
      teamsEnabled: configs.find((c) => c.platform === "TEAMS")?.isActive ?? false,
      jiraEnabled: configs.find((c) => c.platform === "JIRA")?.isActive ?? false,
    }),
  resetForNewUpdate: () =>
    set({
      step: "editing",
      rawTranscript: "",
      isRecording: false,
      recordingSeconds: 0,
      audioBlob: null,
      slackOutput: "",
      teamsOutput: "",
      workLogEntries: [],
      processingError: null,
      isTranscribing: false,
      processingStage: null,
      analyserNode: null,
      previewReady: false,
      isProcessing: false,
      onInvokeSage: null,
      onDispatch: null,
      retryMode: false,
      retryUpdateId: null,
      retrySlackStatus: null,
      retryTeamsStatus: null,
      retryJiraStatus: null,
      // Note: platform toggles are NOT reset — they're set by initPlatformToggles
    }),
  reset: () => set(initialState),
}));
