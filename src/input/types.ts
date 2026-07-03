export type InputSource =
  | "telegram_text"
  | "telegram_voice"
  | "telegram_image"
  | "telegram_document"
  | "link"
  | "email"
  | "pendant"
  | "calendar"
  | "whatsapp"
  | "browser";

export type NormalizedInput = {
  source: InputSource;
  text: string;
  title?: string | null;
  description?: string | null;
  language?: string | null;
  originalRef?: string | null;
  metadata?: Record<string, unknown>;
};

export type TextInput = {
  source?: InputSource;
  text: string;
  title?: string | null;
  metadata?: Record<string, unknown>;
};

export type VoiceInput = {
  source?: InputSource;
  fileId: string;
  metadata?: Record<string, unknown>;
};

export type ImageInput = {
  source?: InputSource;
  fileId: string;
  caption?: string | null;
  metadata?: Record<string, unknown>;
};

export type DocumentInput = {
  source?: InputSource;
  fileId: string;
  fileName?: string | null;
  mimeType?: string | null;
  metadata?: Record<string, unknown>;
};

export type LinkInput = {
  source?: InputSource;
  url: string;
  metadata?: Record<string, unknown>;
};

export type NormalizeInputRequest =
  | { kind: "text"; input: TextInput }
  | { kind: "voice"; input: VoiceInput }
  | { kind: "image"; input: ImageInput }
  | { kind: "document"; input: DocumentInput }
  | { kind: "link"; input: LinkInput };