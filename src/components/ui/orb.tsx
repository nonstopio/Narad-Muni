"use client";

import { ThinkingOrb, type OrbState } from "thinking-orbs";

export type { OrbState };

// Theme stays "auto": it follows <html data-theme>, so a future light mode just flips that attribute.
// No label = decorative (visible text beside it already says what is happening).
export function Orb({
  state,
  size = 20,
  label,
  className,
}: {
  state: OrbState;
  size?: 64 | 32 | 20;
  label?: string;
  className?: string;
}) {
  return (
    <ThinkingOrb
      state={state}
      size={size}
      className={className}
      {...(label ? { "aria-label": label } : { "aria-hidden": true })}
    />
  );
}
