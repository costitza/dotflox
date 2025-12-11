"use server";

const ELEVENLABS_STT_URL =
  process.env.ELEVENLABS_STT_URL ??
  "https://api.elevenlabs.io/v1/speech-to-text";

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
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

  const model =
    (typeof incoming.get("model") === "string"
      ? (incoming.get("model") as string)
      : "") || "scribe_v1";

  const elevenForm = new FormData();
  elevenForm.set("file", audioFile);
  elevenForm.set("model_id", model);

  const elevenRes = await fetch(ELEVENLABS_STT_URL, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: elevenForm,
  });

  if (!elevenRes.ok) {
    const errorText = await elevenRes.text().catch(() => "");
    return new Response(
      `ElevenLabs STT request failed: ${elevenRes.status} ${errorText}`,
      { status: 502 },
    );
  }

  const data = (await elevenRes.json().catch(() => null)) as
    | { text?: string; transcription?: string }
    | null;

  const transcript = data?.text ?? data?.transcription ?? "";

  if (!transcript) {
    return new Response("No transcript returned from ElevenLabs.", {
      status: 502,
    });
  }

  return Response.json({ text: transcript });
}


