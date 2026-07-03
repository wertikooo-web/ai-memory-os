import { normalizeDocument } from "./document.js";
import { normalizeImage } from "./image.js";
import { normalizeLink } from "./link.js";
import { normalizeText } from "./text.js";
import type { NormalizedInput, NormalizeInputRequest } from "./types.js";
import { normalizeVoice } from "./voice.js";

export async function normalizeInput(request: NormalizeInputRequest): Promise<NormalizedInput> {
  switch (request.kind) {
    case "text":
      return normalizeText(request.input);
    case "voice":
      return normalizeVoice(request.input);
    case "image":
      return normalizeImage(request.input);
    case "document":
      return normalizeDocument(request.input);
    case "link":
      return normalizeLink(request.input);
  }
}