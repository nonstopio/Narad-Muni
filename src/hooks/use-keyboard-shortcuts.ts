"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUpdateStore } from "@/stores/update-store";
import { useShortcutsModalStore } from "@/components/settings/keyboard-shortcuts-card";

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const lastKeyRef = useRef<{ key: string; timestamp: number } | null>(null);

  useEffect(() => {
    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform);

    function handleKeyDown(e: KeyboardEvent) {
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // ⌘+1/2/3 — navigate to pages (always active)
      if (mod && !e.shiftKey) {
        if (e.key === "1") {
          e.preventDefault();
          router.push("/");
          return;
        }
        if (e.key === "2") {
          e.preventDefault();
          router.push("/history");
          return;
        }
        if (e.key === "3") {
          e.preventDefault();
          router.push("/settings");
          return;
        }
        if (e.key === "4") {
          e.preventDefault();
          router.push("/report");
          return;
        }
      }

      // ⌘+Enter — Invoke the Sage (works in textareas)
      if (mod && !e.shiftKey && e.key === "Enter") {
        const cb = useUpdateStore.getState().onInvokeSage;
        if (cb) {
          e.preventDefault();
          cb();
          return;
        }
      }

      // ⌘+⇧+Enter — Dispatch to All Worlds (works in textareas)
      if (mod && e.shiftKey && e.key === "Enter") {
        const cb = useUpdateStore.getState().onDispatch;
        if (cb) {
          e.preventDefault();
          cb();
          return;
        }
      }

      // ⌘+R — toggle voice recording (works even in inputs)
      if (e.key === "r" && mod && !e.shiftKey && !e.altKey) {
        const state = useUpdateStore.getState();
        if (state.onToggleRecording) {
          e.preventDefault();
          state.onToggleRecording();
          return;
        }
        if (state.retryMode) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        state.setAutoStartRecording(true);
        const today = new Date().toISOString().split("T")[0];
        router.push(`/update?date=${today}`);
        return;
      }

      // Escape — close shortcuts modal first, then existing logic
      if (e.key === "Escape") {
        if (useShortcutsModalStore.getState().open) {
          useShortcutsModalStore.getState().close();
          return;
        }
        document.dispatchEvent(new CustomEvent("narada:escape"));
        if (pathname === "/update") {
          e.preventDefault();
          router.push("/");
        }
        return;
      }

      // --- Below: single-key shortcuts, skip when in inputs ---
      if (isInputFocused()) return;

      // G-sequence: check if second key
      const now = Date.now();
      const last = lastKeyRef.current;
      if (last && last.key === "g" && now - last.timestamp < 1000) {
        if (e.key === "h") {
          e.preventDefault();
          lastKeyRef.current = null;
          router.push("/");
          return;
        }
        if (e.key === "c") {
          e.preventDefault();
          lastKeyRef.current = null;
          router.push("/history");
          return;
        }
        if (e.key === "s") {
          e.preventDefault();
          lastKeyRef.current = null;
          router.push("/settings");
          return;
        }
        if (e.key === "r") {
          e.preventDefault();
          lastKeyRef.current = null;
          router.push("/report");
          return;
        }
      }

      // Store 'g' press for sequence
      if (e.key === "g" && !mod && !e.shiftKey && !e.altKey) {
        lastKeyRef.current = { key: "g", timestamp: now };
        return;
      }

      // N — new update for today
      if (e.key === "n" && !mod && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const today = new Date().toISOString().split("T")[0];
        router.push(`/update?date=${today}`);
        return;
      }

      // ? — toggle keyboard shortcuts modal
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        useShortcutsModalStore.getState().toggle();
        return;
      }

      // Clear sequence for any other key
      lastKeyRef.current = null;
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router, pathname]);
}
