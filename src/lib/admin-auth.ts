import { type NextRequest } from "next/server";
import { verifyAuth, AuthError, type AuthUser } from "./auth-middleware";
import { adminDb } from "./firebase-admin";

/**
 * Check if a UID is in the admin list stored in Firestore at `app/admins`.
 */
export async function isAdmin(uid: string): Promise<boolean> {
  const doc = await adminDb.collection("app").doc("admins").get();
  if (!doc.exists) return false;
  const uids: string[] = doc.data()?.uids ?? [];
  return uids.includes(uid);
}

/**
 * Verify auth + admin access. Returns AuthUser or throws AuthError(403).
 */
export async function verifyAdmin(request: NextRequest): Promise<AuthUser> {
  const user = await verifyAuth(request);
  if (!(await isAdmin(user.uid))) {
    throw new AuthError("Only the highest sages may enter the observatory", 403);
  }
  return user;
}
