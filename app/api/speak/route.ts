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

  // `audio` is a binary payload from the AI SDK; cast to `BodyInit`
  // so we can return it as the response body.
  return new Response(audio as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}


