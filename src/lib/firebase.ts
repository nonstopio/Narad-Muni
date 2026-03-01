import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyApbeiVzABgppnEMwAfp-jcpgMfiDGEFOQ",
  authDomain: "narad-muni.firebaseapp.com",
  projectId: "narad-muni",
  storageBucket: "narad-muni.firebasestorage.app",
  messagingSenderId: "476987950498",
  appId: "1:476987950498:web:14cad1d2fd3e5c26d62e57",
  measurementId: "G-Y0GC6M8C91",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Analytics — only in browser, not SSR
export const initAnalytics = async () => {
  if (typeof window !== "undefined" && (await isSupported())) {
    return getAnalytics(app);
  }
  return null;
};

export { app };
