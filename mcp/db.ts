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
  } catch {
    // Fall through
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
      const sa = JSON.parse(fs.readFileSync(saPath, "utf-8")) as ServiceAccount;
      initializeApp({ credential: cert(sa) });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf-8");
      const sa = JSON.parse(json) as ServiceAccount;
      initializeApp({ credential: cert(sa) });
    } else {
      throw new Error(
        "Firebase service account not found. Set NARADA_FIREBASE_SA_PATH or FIREBASE_SERVICE_ACCOUNT_BASE64."
      );
    }
  }
  return getFirestore();
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
