"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UpdateData } from "@/types";
import { HistoryDetailModal } from "./history-detail-modal";

interface Props {
  updates: UpdateData[];
}

function StatusBadge({
  platform,
  status,
}: {
  platform: string;
  status: string;
}) {
  const isSuccess = status === "SENT";
  const isFailed = status === "FAILED";
  const isSkipped = status === "SKIPPED";

  if (isSkipped) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium ${
        isSuccess
          ? "bg-emerald-500/10 border border-emerald-500/30 text-narada-emerald"
          : isFailed
            ? "bg-rose-500/10 border border-rose-500/30 text-narada-rose"
            : "bg-white/[0.03] border border-white/[0.06] text-narada-text-muted"
      }`}
    >
      {isSuccess ? "\u2713" : isFailed ? "\u2717" : "\u2022"} {platform}
    </span>
  );
}

export function HistoryList({ updates: initialUpdates }: Props) {
  const [search, setSearch] = useState("");
  const [selectedUpdate, setSelectedUpdate] = useState<UpdateData | null>(null);
  const [updates, setUpdates] = useState(initialUpdates);
  const router = useRouter();

  const filtered = updates.filter((u) =>
    search
      ? u.rawTranscript.toLowerCase().includes(search.toLowerCase()) ||
        u.slackOutput.toLowerCase().includes(search.toLowerCase())
      : true
  );

  function handleDelete(id: string) {
    setUpdates((prev) => prev.filter((u) => u.id !== id));
    setSelectedUpdate(null);
    router.refresh();
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <h1 className="text-[28px] font-bold text-narada-text mb-6">History</h1>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search updates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="glass-input max-w-[400px]"
        />
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="glass-card p-8 text-center text-narada-text-muted">
            {updates.length === 0
              ? "No updates yet. Click a calendar day to create your first update."
              : "No updates match your search."}
          </div>
        ) : (
          filtered.map((update) => (
            <div
              key={update.id}
              className="glass-card p-4 cursor-pointer hover:bg-white/[0.04] transition-colors"
              onClick={() => setSelectedUpdate(update)}
            >
              <div className="text-xs text-narada-text-muted mb-1.5">
                {new Date(update.date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                at{" "}
                {new Date(update.createdAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
              <div className="text-sm text-narada-text-secondary mb-2 line-clamp-2">
                {update.rawTranscript}
              </div>
              <div className="flex gap-2 flex-wrap">
                <StatusBadge platform="Slack" status={update.slackStatus} />
                <StatusBadge platform="Teams" status={update.teamsStatus} />
                <StatusBadge platform="Jira" status={update.jiraStatus} />
              </div>
            </div>
          ))
        )}
      </div>

      {selectedUpdate && (
        <HistoryDetailModal
          update={selectedUpdate}
          onClose={() => setSelectedUpdate(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
