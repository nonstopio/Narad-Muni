import { NextResponse, type NextRequest } from "next/server";
import { verifyAuth, handleAuthError } from "@/lib/auth-middleware";
import { isAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    const admin = await isAdmin(user.uid);
    return NextResponse.json({ isAdmin: admin });
  } catch (error) {
    return handleAuthError(error);
  }
}
