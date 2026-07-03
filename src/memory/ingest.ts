import { classifyInput } from "../ai/classifyInput.js";
import type { OpenCycleDraft } from "../ai/types.js";
import { shouldClassifyWithLlm } from "../config.js";
import { normalizeInput } from "../input/normalize.js";
import { saveTextMemoryItem } from "./items.js";
import { saveOpenCycle } from "./openCycles.js";

export type TextIngestResult = {
  memoryItemId: string;
  lifeEventName: string;
  openCycle: OpenCycleDraft | null;
  classificationStatus: "disabled" | "saved" | "failed";
};

export async function ingestTelegramText(params: {
  userId: string;
  text: string;
  telegramMessageId?: number;
}): Promise<TextIngestResult> {
  const normalized = await normalizeInput({
    kind: "text",
    input: {
      source: "telegram_text",
      text: params.text,
      metadata: {
        telegramMessageId: params.telegramMessageId
      }
    }
  });

  const memoryItem = await saveTextMemoryItem({
    userId: params.userId,
    text: normalized.text,
    telegramMessageId: params.telegramMessageId
  });

  const lifeEventName = memoryItem.lifeEvent.name;

  if (!shouldClassifyWithLlm()) {
    return {
      memoryItemId: memoryItem.id,
      lifeEventName,
      openCycle: null,
      classificationStatus: "disabled"
    };
  }

  try {
    const draft = await classifyInput({
      text: normalized.text,
      locale: normalized.language ?? "ru"
    });

    await saveOpenCycle({
      userId: params.userId,
      memoryItemId: memoryItem.id,
      rawInput: normalized.text,
      draft,
      rawOutput: draft
    });

    return {
      memoryItemId: memoryItem.id,
      lifeEventName,
      openCycle: draft,
      classificationStatus: "saved"
    };
  } catch (error) {
    console.error("LLM classification failed after MemoryItem save:", error);

    return {
      memoryItemId: memoryItem.id,
      lifeEventName,
      openCycle: null,
      classificationStatus: "failed"
    };
  }
}