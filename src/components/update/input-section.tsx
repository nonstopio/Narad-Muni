"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useUpdateStore } from "@/stores/update-store";
import { useAppStore } from "@/stores/app-store";
import { useToastStore } from "@/components/ui/toast";
import { authedFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, History, Bug, FolderGit2 } from "lucide-react";
import { seekAid } from "@/lib/seek-aid";
import { ProjectFetchDialog, SKIP_TEXT } from "./project-fetch-dialog";
import { buildActivityBlock, insertActivity } from "@/lib/project-activity";
import type { ProjectCollectResult } from "@/types";

const noopSubscribe = () => () => {};
type Found = Extract<ProjectCollectResult, { ok: true }>;

const FETCH_ERRORS: Record<Exclude<Extract<ProjectCollectResult, { ok: false }>["error"], "no-projects">, [string, "error" | "warning"]> = {
  "none-enabled": ["Alas! Every repository is resting — enable one in Sacred Repositories.", "warning"],
  "git-missing": ["Alas! Git is not installed — install it, then summon me again.", "error"],
  "all-failed": ["Alas! None of your repositories could be read. Your words are untouched.", "error"],
  busy: ["Patience! I am still reading your repositories…", "warning"],
  "signed-out": ["Alas! Sign in again so I know whose repositories to read.", "error"],
};

const dayKey = (d: Date | null) => (d ?? new Date()).toLocaleDateString("sv-SE");

interface InputSectionProps {
  onProcess: () => void;
}

export function InputSection({ onProcess }: InputSectionProps) {
  const {
    rawTranscript,
    setRawTranscript,
    processingError,
    isProcessing,
    previewReady,
  } = useUpdateStore();
  const selectedDate = useAppStore((s) => s.selectedDate);

  const [isFetchingLast, setIsFetchingLast] = useState(false);
  const router = useRouter();
  const isElectron = useSyncExternalStore(noopSubscribe, () => !!window.narada?.isElectron, () => false);
  const [isFetchingProjects, setIsFetchingProjects] = useState(false);
  const [projectPreview, setProjectPreview] = useState<Found | null>(null);
  const fetchSeqRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const handleFetchLast = async () => {
    if (isFetchingLast || isProcessing) return;
    setIsFetchingLast(true);
    try {
      const dateStr = selectedDate
        ? selectedDate.toLocaleDateString("sv-SE")
        : new Date().toLocaleDateString("sv-SE");
      const res = await authedFetch(`/api/updates?latest=true&before=${dateStr}`);
      if (!res.ok) throw new Error("request failed");
      const { update } = await res.json();
      const prior = (update?.rawTranscript ?? "").trim();
      if (!prior) {
        useToastStore
          .getState()
          .addToast("Alas! No prior chronicle to draw upon", "warning");
        return;
      }
      setRawTranscript(prior);
      useToastStore
        .getState()
        .addToast("Narayan Narayan! Your last words return — edit, then invoke the sage", "success");
    } catch {
      useToastStore
        .getState()
        .addToast("Alas! The last chronicle eluded my grasp", "error");
    } finally {
      setIsFetchingLast(false);
    }
  };

  const handleFetchProjects = async () => {
    const api = window.narada?.projects;
    if (!api || isFetchingProjects || isProcessing) return;
    const req = { date: dayKey(selectedDate), seq: ++fetchSeqRef.current };
    // A result only lands if nothing newer started, we are still mounted, and the day is unchanged.
    const stale = () =>
      fetchSeqRef.current !== req.seq ||
      !mountedRef.current ||
      dayKey(useAppStore.getState().selectedDate) !== req.date;
    const toast = useToastStore.getState().addToast;
    setIsFetchingProjects(true);
    try {
      const list = await api.list();
      const timeZone =
        ("workdayTimeZone" in list && list.workdayTimeZone) || Intl.DateTimeFormat().resolvedOptions().timeZone;
      const result = await api.collect({ date: req.date, timeZone });
      if (stale()) return;
      if (!result.ok) {
        if (result.error === "no-projects") {
          toast("Alas! No repositories are known to me — add one in Sacred Repositories.", "warning", {
            label: "Open",
            onClick: () => router.push("/settings?section=projects"),
          });
        } else {
          toast(...FETCH_ERRORS[result.error]);
        }
        return;
      }
      if (result.projects.every((p) => p.commits.length === 0)) {
        const skipped = result.skipped.map((s) => `${s.name} — ${SKIP_TEXT[s.reason]}`).join("; ");
        toast(skipped ? `No commits found for this day. Skipped: ${skipped}` : "No commits found for this day.", "warning");
        return;
      }
      setProjectPreview(result);
    } catch (err) {
      console.error("[Narada] Project fetch failed:", err);
      if (!stale()) toast("Alas! None of your repositories could be read. Your words are untouched.", "error");
    } finally {
      if (fetchSeqRef.current === req.seq && mountedRef.current) setIsFetchingProjects(false);
    }
  };

  const handleInsertProjects = (mode: "replace" | "append") => {
    const preview = projectPreview;
    setProjectPreview(null);
    // Never let one day's deeds land in another day's words.
    if (!preview || dayKey(useAppStore.getState().selectedDate) !== preview.date) return;
    const { rawTranscript: current, setRawTranscript: setText, setDraftSource } = useUpdateStore.getState();
    const { text, refreshed } = insertActivity(current, buildActivityBlock(preview), mode);
    setText(text);
    setDraftSource("projects");
    if (refreshed) {
      useToastStore.getState().addToast("Narayan Narayan! I refreshed this day's deeds instead of repeating them.", "success");
    }
  };

  const hasText = rawTranscript.trim().length > 0;

  return (
    <div className="flex flex-col h-full pb-6">
      {/* Section label + fetch-from-last action */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-semibold text-narada-text-secondary uppercase tracking-wider">
          Your Words
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleFetchLast}
            disabled={isFetchingLast || isProcessing}
            className="text-narada-text-muted"
            title="Pre-fill with your last update's words"
          >
            {isFetchingLast ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <History className="w-3.5 h-3.5" />
            )}
            <span>Last Update</span>
          </Button>
          {isElectron && (
            <Button
              variant="ghost"
              size="xs"
              onClick={handleFetchProjects}
              disabled={isFetchingProjects || isProcessing}
              className="text-narada-text-muted"
              title="Fetch this day's commits from your repositories"
            >
              {isFetchingProjects ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FolderGit2 className="w-3.5 h-3.5" />
              )}
              <span>Projects</span>
            </Button>
          )}
        </div>
      </div>

      {projectPreview && (
        <ProjectFetchDialog
          result={projectPreview}
          hasDraft={hasText}
          onCancel={() => setProjectPreview(null)}
          onInsert={handleInsertProjects}
        />
      )}

      {/* Textarea — at top, fills available space */}
      <textarea
        className="glass-input flex-1 min-h-[240px] resize-y text-sm w-full mb-4"
        style={{ fontFamily: "var(--font-sans)" }}
        placeholder={"What deeds did you accomplish today?\nWhat task calls to you next?\nWhat plans do you hold for tomorrow?\nAny obstacles on the path?"}
        value={rawTranscript}
        onChange={(e) => setRawTranscript(e.target.value)}
      />

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
        <div className="mt-3 px-3 py-2 rounded-lg bg-narada-rose/10 border border-narada-rose/20 text-narada-rose text-[13px] flex items-center gap-3">
          <span className="flex-1">{processingError}</span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => seekAid(processingError)}
            className="flex-shrink-0"
          >
            <Bug className="w-3.5 h-3.5" />
            Seek Aid
          </Button>
        </div>
      )}
    </div>
  );
}
