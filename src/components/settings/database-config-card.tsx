"use client";

import { useState, useEffect } from "react";
import { Database, FolderOpen } from "lucide-react";
import { useToastStore } from "@/components/ui/toast";

declare global {
  interface Window {
    narada?: {
      isElectron: boolean;
      pickFilePath: () => Promise<string | null>;
    };
  }
}

export function DatabaseConfigCard() {
  const [dbPath, setDbPath] = useState("");
  const [newPath, setNewPath] = useState("");
  const [isElectron, setIsElectron] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restartNeeded, setRestartNeeded] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    fetch("/api/settings/app-config")
      .then((res) => {
        if (!res.ok) throw new Error("Not Electron");
        return res.json();
      })
      .then((data) => {
        setIsElectron(true);
        setDbPath(data.dbPath);
        setNewPath(data.dbPath);
      })
      .catch(() => {
        setIsElectron(false);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !isElectron) return null;

  const handleBrowse = async () => {
    const picked = await window.narada?.pickFilePath();
    if (picked) {
      setNewPath(picked);
      setRestartNeeded(false);
    }
  };

  const handleSave = async () => {
    if (newPath === dbPath) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/app-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dbPath: newPath }),
      });
      if (!res.ok) throw new Error("Failed");
      setRestartNeeded(true);
      addToast("Database path inscribed. Restart Narada for the change to take effect.", "success");
    } catch {
      addToast("Alas! The path could not be saved", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="text-base font-semibold mb-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/[0.05] flex items-center justify-center text-base">
          <Database className="w-4 h-4 text-narada-emerald" />
        </div>
        <span>Sacred Archives</span>
      </div>

      <p className="text-xs text-narada-text-secondary mb-4">
        The scrolls of your daily wisdom are preserved at this location.
      </p>

      <label className="block text-xs font-semibold text-narada-text-secondary mb-2 uppercase tracking-wider">
        Database File Path
      </label>
      <div className="flex gap-2">
        <div className="flex-1 overflow-hidden">
          <div className="glass-input font-mono text-[13px] truncate" title={newPath}>
            {newPath}
          </div>
        </div>
        <button
          onClick={handleBrowse}
          className="h-[42px] px-3 rounded-xl bg-white/[0.05] border border-white/[0.06] text-narada-text-secondary hover:text-white hover:bg-white/[0.08] transition-all duration-300 flex items-center gap-2 shrink-0"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">Browse</span>
        </button>
      </div>

      {restartNeeded && (
        <div className="mt-3 p-3 rounded-xl border border-narada-amber/30 bg-narada-amber/[0.05]">
          <p className="text-xs text-narada-amber">
            Restart Narada for the new path to take effect.
          </p>
        </div>
      )}

      <div className="flex justify-end mt-4 pt-4 border-t border-white/[0.06]">
        <button
          onClick={handleSave}
          disabled={saving || newPath === dbPath}
          className="h-8 px-3 rounded-xl bg-narada-emerald text-white text-xs font-semibold shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-600 transition-all duration-300 disabled:opacity-50"
        >
          {saving ? "Inscribing..." : "Inscribe Path"}
        </button>
      </div>
    </div>
  );
}
