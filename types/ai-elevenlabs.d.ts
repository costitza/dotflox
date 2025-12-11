declare module "@ai-sdk/elevenlabs" {
  type ElevenLabsConfig = {
    apiKey: string;
  };

  // Minimal runtime-compatible type for the ElevenLabs client used with ai-sdk.
  export function elevenlabs(config: ElevenLabsConfig): (modelId: string) => any;
}


