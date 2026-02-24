"use client";

import { useState } from "react";
import { LifeBuoy, ExternalLink, Loader2, CheckCircle2, RotateCcw } from "lucide-react";

export function ReportClient() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachLogs, setAttachLogs] = useState(true);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          attachLogs,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to prepare the petition");
      }

      window.open(data.issueUrl, "_blank");
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Alas! The petition could not be prepared"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-[600px] mx-auto">
        <h1 className="text-[28px] font-bold text-narada-text mb-2">
          Seek Aid
        </h1>
        <p className="text-narada-text-secondary text-sm mb-8">
          Describe your grievance and the sage shall prepare a petition scroll
          for the celestial realm of GitHub.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="glass-card p-6 flex flex-col gap-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-narada-amber/10 flex items-center justify-center">
                <LifeBuoy className="w-[18px] h-[18px] text-narada-amber" />
              </div>
              <h2 className="text-base font-semibold text-narada-text">
                Petition to the Celestial Maintainers
              </h2>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="title"
                className="text-sm text-narada-text-secondary"
              >
                Title of the Grievance
              </label>
              <input
                id="title"
                type="text"
                className="glass-input"
                placeholder="e.g. Jira worklogs fail to publish"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="description"
                className="text-sm text-narada-text-secondary"
              >
                Description{" "}
                <span className="text-narada-text-muted">(optional)</span>
              </label>
              <textarea
                id="description"
                className="glass-input min-h-[120px] resize-y"
                placeholder="Describe what happened, what you expected, and any steps to reproduce..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
            </div>

            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={attachLogs}
                onChange={(e) => setAttachLogs(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 rounded border-white/10 bg-white/5 text-narada-primary focus:ring-narada-primary/30 accent-narada-primary"
              />
              <span className="text-sm text-narada-text-secondary">
                Attach sacred scrolls of activity (application logs)
              </span>
            </label>

            {error && (
              <div className="text-sm text-narada-rose bg-narada-rose/10 rounded-xl px-4 py-3">
                Alas! {error}
              </div>
            )}

            {success && (
              <div className="text-sm text-narada-emerald bg-narada-emerald/10 rounded-xl px-4 py-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Narayan Narayan! The petition scroll has been prepared — review
                and dispatch it in the celestial realm!
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                disabled={loading || (!title.trim() && !description.trim() && !success && !error)}
                onClick={() => {
                  setTitle("");
                  setDescription("");
                  setAttachLogs(true);
                  setSuccess(false);
                  setError("");
                }}
                className="py-3 px-4 rounded-xl font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2 bg-white/[0.03] text-narada-text-secondary border border-white/[0.06] hover:bg-white/[0.06] hover:text-narada-text disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                Clear
              </button>
              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2 bg-narada-amber/20 text-narada-amber border border-narada-amber/20 hover:bg-narada-amber/30 hover:border-narada-amber/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    The sage is preparing your petition...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    Send Petition
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
