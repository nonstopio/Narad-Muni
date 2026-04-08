import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { initializeApp, cert, getApps, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Resolve the path to the narada.config.json that stores the Firebase user ID.
 */
function resolveConfigPath(): string {
  let userDataDir = process.env.NARADA_USER_DATA_DIR;

  if (!userDataDir) {
    const APP_NAME = "Narad Muni";
    if (process.platform === "darwin") {
      userDataDir = path.join(os.homedir(), "Library", "Application Support", APP_NAME);
    } else if (process.platform === "win32") {
      userDataDir = path.join(
        process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
        APP_NAME
      );
    } else {
      userDataDir = path.join(
        process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
        APP_NAME
      );
    }
  }

  return path.join(userDataDir, "narada.config.json");
}

/**
 * Read the Firebase user ID from narada.config.json.
 * Written by the Electron app on login.
 */
export function readUserId(): string {
  const configPath = resolveConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config.firebaseUserId) {
        return config.firebaseUserId;
      }
    }
  } catch (err) {
    process.stderr.write(`[narada-mcp] readUserId error reading config: ${err}\n`);
  }
  throw new Error(
    "No Firebase user ID found. Sign in to Narad Muni at least once."
  );
}

/**
 * Initialize Firebase Admin SDK and return Firestore instance.
 * Reads service account from NARADA_FIREBASE_SA_PATH env var.
 */
export function getDb(): Firestore {
  if (getApps().length === 0) {
    const saPath = process.env.NARADA_FIREBASE_SA_PATH;
    if (saPath && fs.existsSync(saPath)) {
      process.stderr.write(`[narada-mcp] getDb: using NARADA_FIREBASE_SA_PATH: ${saPath}\n`);
      const sa = JSON.parse(fs.readFileSync(saPath, "utf-8")) as ServiceAccount;
      initializeApp({ credential: cert(sa) });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      process.stderr.write(`[narada-mcp] getDb: using FIREBASE_SERVICE_ACCOUNT_BASE64 (${process.env.FIREBASE_SERVICE_ACCOUNT_BASE64.length} chars)\n`);
      const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf-8");
      const sa = JSON.parse(json) as ServiceAccount;
      initializeApp({ credential: cert(sa) });
    } else {
      const reason = saPath
        ? `NARADA_FIREBASE_SA_PATH set to "${saPath}" but file does not exist`
        : "Neither NARADA_FIREBASE_SA_PATH nor FIREBASE_SERVICE_ACCOUNT_BASE64 is set";
      process.stderr.write(`[narada-mcp] getDb: ${reason}\n`);
      throw new Error(
        "Firebase service account not found. Set NARADA_FIREBASE_SA_PATH or FIREBASE_SERVICE_ACCOUNT_BASE64."
      );
    }
  }
  return getFirestore();
}

/**
 * Read the draft for a given date.
 * Returns the rawTranscript if it exists, null otherwise.
 */
export async function getDraft(
  db: Firestore,
  userId: string,
  dateStr: string
): Promise<string | null> {
  const doc = await db
    .collection("users")
    .doc(userId)
    .collection("drafts")
    .doc(dateStr)
    .get();

  if (!doc.exists) return null;
  return (doc.data()?.rawTranscript as string) || null;
}

/**
 * Replace the entire draft content for a given date.
 * If content is empty, deletes the draft doc.
 */
export async function replaceDraft(
  db: Firestore,
  userId: string,
  dateStr: string,
  content: string
): Promise<void> {
  const draftRef = db
    .collection("users")
    .doc(userId)
    .collection("drafts")
    .doc(dateStr);

  if (!content.trim()) {
    await draftRef.delete();
    return;
  }

  await draftRef.set(
    {
      date: dateStr,
      rawTranscript: content,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

export interface UpdateStatus {
  exists: boolean;
  slackStatus?: string;
  teamsStatus?: string;
  jiraStatus?: string;
  workLogTotal?: number;
  workLogPosted?: number;
}

/**
 * Check if an update has been published for a given date.
 * Returns platform statuses and worklog counts.
 */
export async function getUpdateForDate(
  db: Firestore,
  userId: string,
  dateStr: string
): Promise<UpdateStatus> {
  const snapshot = await db
    .collection("users")
    .doc(userId)
    .collection("updates")
    .where("date", "==", dateStr)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return { exists: false };
  }

  const data = snapshot.docs[0].data();
  const workLogEntries = (data.workLogEntries || []) as Array<{ jiraWorklogId?: string | null }>;

  return {
    exists: true,
    slackStatus: data.slackStatus,
    teamsStatus: data.teamsStatus,
    jiraStatus: data.jiraStatus,
    workLogTotal: workLogEntries.length,
    workLogPosted: workLogEntries.filter((e) => !!e.jiraWorklogId).length,
  };
}

/**
 * Append an entry line to the day's draft in Firestore.
 * Creates the draft doc if it doesn't exist.
 * Returns the full draft content after appending.
 */
export async function appendToDraft(
  db: Firestore,
  userId: string,
  dateStr: string,
  entryLine: string
): Promise<string> {
  const draftRef = db
    .collection("users")
    .doc(userId)
    .collection("drafts")
    .doc(dateStr);

  return db.runTransaction(async (tx) => {
    const doc = await tx.get(draftRef);

    if (doc.exists) {
      const existing = doc.data()?.rawTranscript || "";
      const newText = existing + "\n" + entryLine;
      tx.update(draftRef, {
        rawTranscript: newText,
        updatedAt: new Date().toISOString(),
      });
      return newText;
    } else {
      tx.set(draftRef, {
        date: dateStr,
        rawTranscript: entryLine,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      return entryLine;
    }
  });
}
