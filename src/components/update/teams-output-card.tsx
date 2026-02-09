"use client";

import { useUpdateStore } from "@/stores/update-store";
import { Users, Check } from "lucide-react";

export function TeamsOutputCard() {
  const { teamsOutput, setTeamsOutput, teamsEnabled, togglePlatform } =
    useUpdateStore();

  return (
    <div
      className={`bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 backdrop-blur-[20px] transition-opacity duration-300 ${
        !teamsEnabled ? "opacity-50" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Users className="w-4.5 h-4.5 text-narada-text-secondary" />
          <span className="text-sm font-semibold text-narada-text">Teams</span>
        </div>
        <button
          onClick={() => togglePlatform("teams")}
          className={`px-3 py-1 rounded-3xl text-[11px] font-medium flex items-center gap-1.5 transition-all duration-300 ${
            teamsEnabled
              ? "bg-narada-primary border border-narada-primary text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
              : "bg-white/[0.03] border border-white/[0.06] text-narada-text-secondary hover:bg-white/[0.06]"
          }`}
        >
          {teamsEnabled && <Check className="w-3 h-3" />}
          <span>{teamsEnabled ? "Enabled" : "Disabled"}</span>
        </button>
      </div>

      {/* Body */}
      <textarea
        className="glass-input min-h-[160px] font-mono text-[13px] text-narada-text-secondary resize-y w-full"
        value={teamsOutput}
        onChange={(e) => setTeamsOutput(e.target.value)}
        disabled={!teamsEnabled}
        placeholder="Teams output will appear here after processing..."
      />
    </div>
  );
}
