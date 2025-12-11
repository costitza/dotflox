"use server";

import { experimental_generateSpeech as generateSpeech } from "ai";
import { elevenlabs } from "@ai-sdk/elevenlabs";

export async function POST(req: Request) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return new Response("Text-to-speech is not configured.", { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const modelId = "eleven_multilingual_v2";

  if (!text) {
    return new Response("Missing `text` in request body.", { status: 400 });
  }

  const { audio } = await generateSpeech({
    model: elevenlabs.speech(modelId),
    text,
  });

  // Convert the GeneratedAudioFile into a Blob so Next can send
  // a single, complete audio response rather than a hanging stream.
  const arrayBuffer = audio.uint8Array.buffer as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });

  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}


