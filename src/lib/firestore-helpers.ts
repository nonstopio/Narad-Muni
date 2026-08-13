import { adminDb } from "./firebase-admin";

export const userDoc = (uid: string) => adminDb.collection("users").doc(uid);
export const configsCol = (uid: string) => userDoc(uid).collection("configs");
export const updatesCol = (uid: string) => userDoc(uid).collection("updates");
export const draftsCol = (uid: string) => userDoc(uid).collection("drafts");
export const settingsDoc = (uid: string) => userDoc(uid).collection("settings").doc("app");
export const broadcastsCol = (uid: string) => userDoc(uid).collection("broadcasts");

/** Slack config fields needed to talk to the Web API. */
export async function getSlackCreds(
  uid: string
): Promise<{ token: string | null; timezone: string | null }> {
  const snap = await configsCol(uid).doc("SLACK").get();
  const cfg = snap.data() as
    | { slackUserToken?: string; slackBotToken?: string; timezone?: string }
    | undefined;
  return {
    // The user token wins so missives bear your own name, not the sage's.
    token: cfg?.slackUserToken?.trim() || cfg?.slackBotToken?.trim() || null,
    timezone: cfg?.timezone?.trim() || null,
  };
}
