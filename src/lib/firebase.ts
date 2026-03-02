import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBS0kmYQfvMBj68riUwi8AkIMCIDtpQbIk",
  authDomain: "narad-muni-14.firebaseapp.com",
  projectId: "narad-muni-14",
  storageBucket: "narad-muni-14.firebasestorage.app",
  messagingSenderId: "24086585074",
  appId: "1:24086585074:web:73d1e2cbec7daaf2727a6b",
  measurementId: "G-YPN0P89E8Z",
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
