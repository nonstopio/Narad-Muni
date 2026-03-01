"use client";

import { useAuth } from "./auth-provider";
import { LoginScreen } from "./login-screen";
import type { ReactNode } from "react";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0A0A0F] z-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-narada-blue/30 border-t-narada-blue rounded-full animate-spin" />
          <p className="text-sm text-narada-text-secondary">
            The sage is awakening...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
