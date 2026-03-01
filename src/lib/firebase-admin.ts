import {
  initializeApp,
  getApps,
  cert,
  type App,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (base64) {
    try {
      const json = Buffer.from(base64, "base64").toString("utf-8");
      const serviceAccount = JSON.parse(json);
      return initializeApp({ credential: cert(serviceAccount) });
    } catch (err) {
      throw new Error(
        `Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  // Fallback: try GOOGLE_APPLICATION_CREDENTIALS or default credentials
  console.warn("[Narada] No FIREBASE_SERVICE_ACCOUNT_BASE64 set — falling back to default credentials");
  return initializeApp();
}

const adminApp = getAdminApp();

export const adminDb = getFirestore(adminApp);
// Allow undefined values in document data (they are stripped out instead of throwing)
adminDb.settings({ ignoreUndefinedProperties: true });

export const adminAuth = getAuth(adminApp);
export { adminApp };
