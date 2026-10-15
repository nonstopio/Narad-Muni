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
import { auth, initAnalytics, initPerformance } from "@/lib/firebase";
import { trackEvent } from "@/lib/analytics";
import { syncPendingDrafts } from "@/lib/local-drafts";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  storageError: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    // Initialize analytics & performance monitoring
    initAnalytics().catch(() => {});
    initPerformance().catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setStorageError(false);
      setUser(null);
      // Establish the desktop storage owner before mounting any editor.
      try { await window.narada?.setFirebaseUser(firebaseUser?.uid ?? null); }
      catch (err) { console.error("[Narada] Desktop user setup failed:", err); setStorageError(true); setLoading(false); return; }
      if (auth.currentUser?.uid !== firebaseUser?.uid) return;
      setUser(firebaseUser);
      setLoading(false);

      // Notify Electron of auth state + seed defaults for new users
      if (firebaseUser) {
        trackEvent("session_start_narada");
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
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const sync = () => { syncPendingDrafts().catch((err) => console.warn("[Narada] Local draft sync:", err)); };
    sync();
    const interval = setInterval(sync, 30000);
    window.addEventListener("online", sync);
    return () => { clearInterval(interval); window.removeEventListener("online", sync); };
  }, [user]);

  const signIn = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signOutFn = useCallback(async () => {
    trackEvent("sign_out");
    setLoading(true);
    setUser(null);
    await window.narada?.setFirebaseUser(null);
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
      value={{ user, loading, storageError, signIn, signOut: signOutFn, getIdToken }}
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
