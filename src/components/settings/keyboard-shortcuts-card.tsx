"use client";

import { useState } from "react";
import { Keyboard, X } from "lucide-react";
import { create } from "zustand";
import { Button } from "@/components/ui/button";

interface Shortcut {
  description: string;
  keys: string[];
  macKeys?: string[];
}

export const shortcuts: Shortcut[] = [
  { description: "Navigate to Scrolls (Home)", keys: ["Ctrl", "1"], macKeys: ["\u2318", "1"] },
  { description: "Navigate to Chronicles (History)", keys: ["Ctrl", "2"], macKeys: ["\u2318", "2"] },
  { description: "Navigate to Configurations (Settings)", keys: ["Ctrl", "3"], macKeys: ["\u2318", "3"] },
  { description: "Navigate to Seek Aid (Report)", keys: ["Ctrl", "4"], macKeys: ["\u2318", "4"] },
  { description: "Go to Home", keys: ["G", "then", "H"] },
  { description: "Go to Chronicles", keys: ["G", "then", "C"] },
  { description: "Go to Settings", keys: ["G", "then", "S"] },
  { description: "Go to Seek Aid", keys: ["G", "then", "R"] },
  { description: "New update for today", keys: ["N"] },
  { description: "Toggle voice recording", keys: ["Ctrl", "R"], macKeys: ["\u2318", "R"] },
  { description: "Invoke the Sage", keys: ["Ctrl", "Enter"], macKeys: ["\u2318", "Enter"] },
  { description: "Dispatch to All Worlds", keys: ["Ctrl", "\u21E7", "Enter"], macKeys: ["\u2318", "\u21E7", "Enter"] },
  { description: "Close modal / Go back", keys: ["Esc"] },
  { description: "View keyboard shortcuts", keys: ["?"] },
];

// --- Zustand store for modal state ---

interface ShortcutsModalState {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

export const useShortcutsModalStore = create<ShortcutsModalState>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  close: () => set({ open: false }),
}));

// --- Shared shortcuts list rendering ---

function ShortcutsList() {
  const [isMac] = useState(() =>
    typeof navigator !== "undefined"
      ? /Mac|iPhone|iPad|iPod/.test(navigator.platform)
      : true
  );

  return (
    <div className="space-y-1">
      {shortcuts.map((shortcut) => {
        const keys = isMac && shortcut.macKeys ? shortcut.macKeys : shortcut.keys;
        return (
          <div
            key={shortcut.description}
            className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors"
          >
            <span className="text-xs text-narada-text-secondary">{shortcut.description}</span>
            <div className="flex items-center gap-1">
              {keys.map((key, i) =>
                key === "then" ? (
                  <span key={i} className="text-[10px] text-narada-text-muted mx-0.5">then</span>
                ) : (
                  <kbd
                    key={i}
                    className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 text-[11px] font-mono font-medium text-narada-text-secondary bg-white/[0.06] border border-white/[0.1] rounded-md"
                  >
                    {key}
                  </kbd>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Inline card for Settings page ---

export function KeyboardShortcutsCard() {
  return (
    <div id="keyboard-shortcuts" className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Keyboard className="w-4.5 h-4.5 text-narada-violet" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-narada-text">Sacred Gestures</h3>
          <p className="text-xs text-narada-text-muted">Keyboard shortcuts for swift navigation</p>
        </div>
      </div>
      <ShortcutsList />
    </div>
  );
}

// --- Modal overlay (mounted globally in layout.tsx) ---

export function KeyboardShortcutsModal() {
  const { open, close } = useShortcutsModalStore();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={close}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" />

      {/* Modal card */}
      <div
        className="relative w-full max-w-[420px] max-h-[80vh] flex flex-col bg-narada-surface border border-white/[0.06] rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Keyboard className="w-4.5 h-4.5 text-narada-violet" />
            </div>
            <h2 className="text-sm font-semibold text-narada-text">Sacred Gestures</h2>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={close}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <ShortcutsList />
        </div>
      </div>
    </div>
  );
}
