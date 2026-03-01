"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from "firebase/auth";
import { auth, initAnalytics } from "@/lib/firebase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize analytics
    initAnalytics().catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      // Notify Electron of auth state + seed defaults for new users
      if (firebaseUser) {
        window.narada?.setFirebaseUser(firebaseUser.uid);
        // Seed default configs once per session (fire-and-forget, idempotent on server)
        const seedKey = `narada_seeded_${firebaseUser.uid}`;
        if (!sessionStorage.getItem(seedKey)) {
          firebaseUser.getIdToken().then((token) =>
            fetch("/api/auth/seed", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            }).then(() => {
              sessionStorage.setItem(seedKey, "1");
            }).catch((err) => {
              console.warn("[Narada] Seed failed:", err);
            })
          );
        }
      } else {
        window.narada?.setFirebaseUser(null);
      }
    });

    return unsubscribe;
  }, []);

  const signIn = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signOutFn = useCallback(async () => {
    window.narada?.setFirebaseUser(null);
    await firebaseSignOut(auth);
  }, []);

  const getIdToken = useCallback(async () => {
    if (!auth.currentUser) {
      throw new Error("Not authenticated");
    }
    return auth.currentUser.getIdToken();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signOut: signOutFn, getIdToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
