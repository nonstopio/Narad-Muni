import { createClient } from "@deepgram/sdk";
import { prisma } from "@/lib/prisma";

export async function transcribeAudio(
  buffer: Buffer
): Promise<{ transcript: string; confidence: number; duration: number }> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "app-settings" },
  });
  const apiKey = settings?.deepgramApiKey || process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("Deepgram API key not configured. Add it in Settings.");
  }

  const deepgram = createClient(apiKey);

  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    buffer,
    {
      model: "nova-3",
      smart_format: true,
      punctuate: true,
      diarize: false,
    }
  );

  if (error) {
    throw new Error(`Deepgram API error: ${error.message}`);
  }

  const transcript =
    result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  const confidence =
    result?.results?.channels?.[0]?.alternatives?.[0]?.confidence ?? 0;
  const duration = result?.metadata?.duration ?? 0;

  if (!transcript) {
    throw new Error("Deepgram returned an empty transcript — no speech detected in audio");
  }

  return { transcript, confidence, duration };
}
