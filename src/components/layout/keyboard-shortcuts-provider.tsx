"use client";

import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

export function KeyboardShortcutsProvider() {
  useKeyboardShortcuts();
  return null;
}
