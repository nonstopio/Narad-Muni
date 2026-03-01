import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/deepgram";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { settingsDoc } from "@/lib/firestore-helpers";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);

    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Read Deepgram API key from user's settings
    const settingsSnap = await settingsDoc(user.uid).get();
    const deepgramApiKey = settingsSnap.data()?.deepgramApiKey;

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("[transcribe] Received audio:", audioFile.name, "size:", buffer.length, "bytes, type:", audioFile.type);

    const { transcript, confidence, duration } = await transcribeAudio(buffer, deepgramApiKey);
    console.log("[transcribe] Result: confidence:", confidence, "duration:", duration, "transcript length:", transcript.length);

    return NextResponse.json({
      success: true,
      transcript,
      confidence,
      duration,
    });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("Transcription error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Transcription failed",
      },
      { status: 500 }
    );
  }
}
