"use client";

import { AuthProvider } from "./auth-provider";
import { AuthGuard } from "./auth-guard";
import type { ReactNode } from "react";

/**
 * Client-side shell that wraps the app with Firebase Auth.
 * Used in the root layout (which is a server component).
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuard>{children}</AuthGuard>
    </AuthProvider>
  );
}
