import { createClient } from "@deepgram/sdk";

export async function transcribeAudio(
  buffer: Buffer,
  apiKey?: string
): Promise<{ transcript: string; confidence: number; duration: number }> {
  const key = apiKey || process.env.DEEPGRAM_API_KEY;
  if (!key) {
    throw new Error("Deepgram API key not configured. Add it in Settings.");
  }

  const deepgram = createClient(key);

  const config = {
    model: "nova-3",
    smart_format: true,
    punctuate: true,
    diarize: false,
  };
  console.log(`[Narada → Deepgram] Transcribing audio — buffer=${buffer.length} bytes, config=${JSON.stringify(config)}`);

  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    buffer,
    config
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
