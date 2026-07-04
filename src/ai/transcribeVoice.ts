import { config } from "../config.js";

export type TranscribeVoiceParams = {
  audio: ArrayBuffer;
  fileName?: string;
  mimeType?: string;
  language?: string;
};

export async function transcribeVoice(params: TranscribeVoiceParams): Promise<string> {
  if (!config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const form = new FormData();
  const file = new Blob([params.audio], {
    type: params.mimeType ?? "audio/ogg"
  });

  form.append("file", file, params.fileName ?? "voice.ogg");
  form.append("model", config.openAiTranscriptionModel);
  form.append("response_format", "json");

  if (params.language) {
    form.append("language", params.language);
  }

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openAiApiKey}`
    },
    body: form
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI transcription failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { text?: string };
  const text = data.text?.trim();

  if (!text) {
    throw new Error("OpenAI transcription returned empty text.");
  }

  return text;
}