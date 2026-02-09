import { NextRequest, NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/deepgram";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: "No audio file provided" },
        { status: 400 }
      );
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("[transcribe] Received audio:", audioFile.name, "size:", buffer.length, "bytes, type:", audioFile.type);

    const { transcript, confidence, duration } = await transcribeAudio(buffer);
    console.log("[transcribe] Result: confidence:", confidence, "duration:", duration, "transcript length:", transcript.length);

    return NextResponse.json({
      success: true,
      transcript,
      confidence,
      duration,
    });
  } catch (error) {
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
