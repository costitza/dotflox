"use server";

import { experimental_transcribe as transcribe } from "ai";
import { elevenlabs } from "@ai-sdk/elevenlabs";

export async function POST(req: Request) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return new Response("Speech-to-text is not configured.", { status: 500 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return new Response("Expected multipart/form-data with an `audio` file.", {
      status: 400,
    });
  }

  const incoming = await req.formData();
  const audioFile = incoming.get("audio");

  if (!(audioFile instanceof File)) {
    return new Response("Missing `audio` file field in form data.", {
      status: 400,
    });
  }

  // Convert the uploaded File into a Uint8Array for the AI SDK.
  const arrayBuffer = await audioFile.arrayBuffer();
  const audioBytes = new Uint8Array(arrayBuffer);

  // Optional language hint; defaults to automatic detection.
  const language =
    typeof incoming.get("language") === "string"
      ? (incoming.get("language") as string)
      : undefined;

  const result = await transcribe({
    // Use the ElevenLabs transcription model as documented:
    // https://ai-sdk.dev/providers/ai-sdk-providers/elevenlabs
    model: elevenlabs.transcription("scribe_v1"),
    audio: audioBytes,
    providerOptions: {
      elevenlabs: language ? { languageCode: language } : {},
    },
  });

  // The AI SDK returns a `text` field for ElevenLabs transcriptions.
  const text = (result as any)?.text?.trim?.() ?? "";

  if (!text) {
    return new Response("No transcript returned from ElevenLabs.", {
      status: 502,
    });
  }

  return Response.json({ text });
}
