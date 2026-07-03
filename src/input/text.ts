import type { NormalizedInput, TextInput } from "./types.js";

export async function normalizeText(input: TextInput): Promise<NormalizedInput> {
  const text = input.text.trim();
  if (!text) {
    throw new Error("Text input is empty.");
  }

  return {
    source: input.source ?? "telegram_text",
    text,
    title: input.title ?? null,
    metadata: input.metadata
  };
}