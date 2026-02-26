"use client";

import { useState } from "react";
import { Keyboard } from "lucide-react";

interface Shortcut {
  description: string;
  keys: string[];
  macKeys?: string[];
}

const shortcuts: Shortcut[] = [
  { description: "Navigate to Scrolls (Home)", keys: ["Ctrl", "1"], macKeys: ["\u2318", "1"] },
  { description: "Navigate to Chronicles (History)", keys: ["Ctrl", "2"], macKeys: ["\u2318", "2"] },
  { description: "Navigate to Configurations (Settings)", keys: ["Ctrl", "3"], macKeys: ["\u2318", "3"] },
  { description: "Navigate to Seek Aid (Report)", keys: ["Ctrl", "4"], macKeys: ["\u2318", "4"] },
  { description: "Go to Home", keys: ["G", "then", "H"] },
  { description: "Go to Chronicles", keys: ["G", "then", "C"] },
  { description: "Go to Settings", keys: ["G", "then", "S"] },
  { description: "Go to Seek Aid", keys: ["G", "then", "R"] },
  { description: "New update for today", keys: ["N"] },
  { description: "Toggle voice recording", keys: ["Ctrl", "R"], macKeys: ["⌘", "R"] },
  { description: "Invoke the Sage", keys: ["Ctrl", "Enter"], macKeys: ["\u2318", "Enter"] },
  { description: "Dispatch to All Worlds", keys: ["Ctrl", "\u21E7", "Enter"], macKeys: ["\u2318", "\u21E7", "Enter"] },
  { description: "Close modal / Go back", keys: ["Esc"] },
  { description: "View keyboard shortcuts", keys: ["?"] },
];

export function KeyboardShortcutsCard() {
  const [isMac] = useState(() =>
    typeof navigator !== "undefined"
      ? /Mac|iPhone|iPad|iPod/.test(navigator.platform)
      : true
  );

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
    </div>
  );
}
