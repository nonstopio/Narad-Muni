import { create } from "zustand";
import type { DraftSource, ModalStep, ProcessingStage, WorkLogEntryData, PlatformConfigData, PublishStatus, UpdateMetricsHints } from "@/types";

interface UpdateStore {
  step: ModalStep;
  rawTranscript: string;
  // Where the words came from; "projects" once commit activity is inserted.
  draftSource: DraftSource;
  setDraftSource: (source: DraftSource) => void;
  slackOutput: string;
  teamsOutput: string;
  workLogEntries: WorkLogEntryData[];
  slackEnabled: boolean;
  teamsEnabled: boolean;
  jiraEnabled: boolean;
  processingError: string | null;
  processingStage: ProcessingStage | null;
  previewReady: boolean;
  isProcessing: boolean;

  // Jira linkification
  jiraBaseUrl: string | null;
  setJiraBaseUrl: (url: string | null) => void;

  // Metrics hints carried forward from parse to publish
  metricsHints: UpdateMetricsHints | null;
  setMetricsHints: (hints: UpdateMetricsHints | null) => void;
  mergeMetricsHints: (patch: Partial<UpdateMetricsHints>) => void;

  // Retry mode
  retryMode: boolean;
  retryUpdateId: string | null;
  retrySlackStatus: PublishStatus | null;
  retryTeamsStatus: PublishStatus | null;
  retryJiraStatus: PublishStatus | null;

  setStep: (step: ModalStep) => void;
  setRawTranscript: (text: string) => void;
  setSlackOutput: (output: string) => void;
  setTeamsOutput: (output: string) => void;
  setWorkLogEntries: (entries: WorkLogEntryData[]) => void;
  updateWorkLogEntry: (index: number, patch: Partial<WorkLogEntryData>) => void;
  addWorkLogEntry: (entry: WorkLogEntryData) => void;
  removeWorkLogEntry: (index: number) => void;
  togglePlatform: (platform: "slack" | "teams" | "jira") => void;
  setProcessingError: (error: string | null) => void;
  setProcessingStage: (stage: ProcessingStage | null) => void;
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
  draftSource: "manual" as DraftSource,
  slackOutput: "",
  teamsOutput: "",
  workLogEntries: [] as WorkLogEntryData[],
  slackEnabled: false,
  teamsEnabled: false,
  jiraEnabled: false,
  processingError: null as string | null,
  processingStage: null as ProcessingStage | null,
  previewReady: false,
  isProcessing: false,
  onInvokeSage: null as (() => void) | null,
  onDispatch: null as (() => void) | null,
  jiraBaseUrl: null as string | null,
  retryMode: false,
  retryUpdateId: null as string | null,
  retrySlackStatus: null as PublishStatus | null,
  retryTeamsStatus: null as PublishStatus | null,
  retryJiraStatus: null as PublishStatus | null,
  metricsHints: null as UpdateMetricsHints | null,
};

export const useUpdateStore = create<UpdateStore>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  // Emptying the words forgets where they came from.
  setRawTranscript: (text) => set(text ? { rawTranscript: text } : { rawTranscript: text, draftSource: "manual" }),
  setDraftSource: (source) => set({ draftSource: source }),
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
  setProcessingStage: (stage) => set({ processingStage: stage }),
  setPreviewReady: (ready) => set({ previewReady: ready }),
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  setOnInvokeSage: (cb) => set({ onInvokeSage: cb }),
  setOnDispatch: (cb) => set({ onDispatch: cb }),
  setJiraBaseUrl: (url) => set({ jiraBaseUrl: url }),
  setRetryMode: (mode) => set({ retryMode: mode }),
  setRetryUpdateId: (id) => set({ retryUpdateId: id }),
  setRetryStatuses: (slack, teams, jira) =>
    set({ retrySlackStatus: slack, retryTeamsStatus: teams, retryJiraStatus: jira }),
  setMetricsHints: (hints) => set({ metricsHints: hints }),
  mergeMetricsHints: (patch) =>
    set((state) => ({ metricsHints: { ...(state.metricsHints ?? {}), ...patch } })),
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
      draftSource: "manual",
      slackOutput: "",
      teamsOutput: "",
      workLogEntries: [],
      processingError: null,
      processingStage: null,
      previewReady: false,
      isProcessing: false,
      onInvokeSage: null,
      onDispatch: null,
      retryMode: false,
      retryUpdateId: null,
      retrySlackStatus: null,
      retryTeamsStatus: null,
      retryJiraStatus: null,
      metricsHints: null,
      // Note: platform toggles are NOT reset — they're set by initPlatformToggles
    }),
  reset: () => set(initialState),
}));
