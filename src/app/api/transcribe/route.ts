import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/deepgram";
import { verifyAuth, isAuthError, handleAuthError } from "@/lib/auth-middleware";
import { settingsDoc } from "@/lib/firestore-helpers";
import { time } from "@/lib/timing";

export async function POST(request: NextRequest) {
  const routeStart = Date.now();
  try {
    const user = await verifyAuth(request);
    console.log(`[Narada] POST /api/transcribe uid=${user.uid}`);

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

    const { result, ms: deepgramMs } = await time(() => transcribeAudio(buffer, deepgramApiKey));
    const { transcript, confidence, duration } = result;
    console.log(`[transcribe] Result: confidence=${confidence} duration=${duration} transcript_chars=${transcript.length} deepgram_ms=${deepgramMs}`);

    const totalMs = Date.now() - routeStart;
    return NextResponse.json({
      success: true,
      transcript,
      confidence,
      duration,
      _timings: {
        totalMs,
        deepgramMs,
        overheadMs: Math.max(0, totalMs - deepgramMs),
        audioSizeBytes: buffer.length,
      },
    });
  } catch (error) {
    if (isAuthError(error)) return handleAuthError(error);
    console.error("[Narada] POST /api/transcribe error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Transcription failed",
      },
      { status: 500 }
    );
  }
}
