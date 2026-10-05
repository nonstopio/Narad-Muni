import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { settingsDoc } from "@/lib/firestore-helpers";
import {
  VALID_PROVIDERS,
  buildSettingsResponse,
  buildSettingsUpdate,
  normalizeUseGlobalFor,
  type StoredSettings,
} from "@/lib/ai-settings";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] GET /api/settings/ai-provider uid=${user.uid}`);
    const doc = await settingsDoc(user.uid).get();
    return NextResponse.json(buildSettingsResponse(doc.data() as StoredSettings | undefined));
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API AI Provider] GET failed:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] PUT /api/settings/ai-provider uid=${user.uid}`);
    const body = await request.json();
    const { aiProvider, useGlobalFor } = body;

    if (aiProvider && !VALID_PROVIDERS.includes(aiProvider)) {
      return NextResponse.json(
        { error: `Invalid AI provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
        { status: 400 }
      );
    }

    const updateData = buildSettingsUpdate(body);

    const normalizedUseGlobalFor = normalizeUseGlobalFor(useGlobalFor);
    if (normalizedUseGlobalFor) {
      const existingDoc = await settingsDoc(user.uid).get();
      const existing = (existingDoc.data() as StoredSettings | undefined)?.useGlobalFor ?? {};
      updateData.useGlobalFor = { ...existing, ...normalizedUseGlobalFor };
    }

    const ref = settingsDoc(user.uid);
    await ref.set(updateData, { merge: true });

    const doc = await ref.get();
    return NextResponse.json(buildSettingsResponse(doc.data() as StoredSettings | undefined));
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada API AI Provider] PUT failed:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
