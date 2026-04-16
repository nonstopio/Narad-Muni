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
  console.log(`[Narada] Firebase Admin init — FIREBASE_SERVICE_ACCOUNT_BASE64 present: ${!!base64}, length: ${base64?.length ?? 0}`);
  if (base64) {
    try {
      const json = Buffer.from(base64, "base64").toString("utf-8");
      const serviceAccount = JSON.parse(json);
      const app = initializeApp({ credential: cert(serviceAccount) });
      console.log(`[Narada] Firebase Admin initialized with service account (project: ${serviceAccount.project_id})`);
      return app;
    } catch (err) {
      console.error("[Narada] Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:", err);
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
console.log(`[Narada] Firebase Admin app ready (project: ${adminApp.options.projectId ?? "unknown"})`);

export const adminDb = getFirestore(adminApp);
// Allow undefined values in document data (they are stripped out instead of throwing).
// `settings()` can only be called once per Firestore instance; on Next.js dev hot-reload
// the module may re-evaluate while the underlying Firestore singleton persists.
try {
  adminDb.settings({ ignoreUndefinedProperties: true });
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  if (!message.includes("already been initialized")) throw err;
}

export const adminAuth = getAuth(adminApp);
export { adminApp };
