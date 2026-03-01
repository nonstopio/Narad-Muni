import { adminDb } from "./firebase-admin";

export const userDoc = (uid: string) => adminDb.collection("users").doc(uid);
export const configsCol = (uid: string) => userDoc(uid).collection("configs");
export const updatesCol = (uid: string) => userDoc(uid).collection("updates");
export const draftsCol = (uid: string) => userDoc(uid).collection("drafts");
export const settingsDoc = (uid: string) => userDoc(uid).collection("settings").doc("app");
