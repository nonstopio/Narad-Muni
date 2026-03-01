import { type NextRequest, NextResponse } from "next/server";
import { adminAuth } from "./firebase-admin";

export interface AuthUser {
  uid: string;
  email: string | undefined;
  name: string | undefined;
}

/**
 * Verify the Firebase ID token from the Authorization header.
 * Returns the authenticated user info or throws AuthError.
 */
export async function verifyAuth(request: NextRequest): Promise<AuthUser> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Missing or invalid Authorization header", 401);
  }

  const idToken = authHeader.slice(7);

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
    };
  } catch {
    throw new AuthError("Invalid or expired token", 401);
  }
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Type guard for AuthError. */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/** Helper to return a JSON error response from an AuthError. */
export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status }
    );
  }
  console.warn("[Narada] handleAuthError called with non-AuthError:", error);
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
