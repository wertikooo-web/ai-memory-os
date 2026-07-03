import type { NormalizedInput, VoiceInput } from "./types.js";

export async function normalizeVoice(_input: VoiceInput): Promise<NormalizedInput> {
  throw new Error("Voice input normalization is TODO: add transcription provider later.");
}