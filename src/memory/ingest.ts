import { classifyInput } from "../ai/classifyInput.js";
import { classifyIntent } from "../ai/classifyIntent.js";
import type { NaturalIntentDraft, OpenCycleDraft } from "../ai/types.js";
import { shouldClassifyWithLlm } from "../config.js";
import { normalizeInput } from "../input/normalize.js";
import { saveTextMemoryItem } from "./items.js";
import { closeOpenCycleById, listRecentOpenCyclesForIntent, saveOpenCycle } from "./openCycles.js";

export type TextIngestResult = {
  memoryItemId: string;
  lifeEventName: string;
  openCycle: OpenCycleDraft | null;
  closedCycleTitle: string | null;
  intent: NaturalIntentDraft | null;
  classificationStatus: "disabled" | "saved" | "closed" | "close_target_not_found" | "memory_only" | "unsupported_intent" | "failed";
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
      closedCycleTitle: null,
      intent: null,
      classificationStatus: "disabled"
    };
  }

  try {
    const recentOpenCycles = await listRecentOpenCyclesForIntent(params.userId);
    const intent = await classifyIntent({
      text: normalized.text,
      recentOpenCycles,
      locale: normalized.language ?? "ru"
    });

    if (intent.intent === "CLOSE_OPEN_CYCLE" && intent.targetOpenCycleId) {
      const closed = await closeOpenCycleById({
        userId: params.userId,
        openCycleId: intent.targetOpenCycleId
      });

      if (closed) {
        return {
          memoryItemId: memoryItem.id,
          lifeEventName,
          openCycle: null,
          closedCycleTitle: closed.title,
          intent,
          classificationStatus: "closed"
        };
      }
    }

    if (intent.intent === "CLOSE_OPEN_CYCLE") {
      return {
        memoryItemId: memoryItem.id,
        lifeEventName,
        openCycle: null,
        closedCycleTitle: null,
        intent,
        classificationStatus: "close_target_not_found"
      };
    }

    if (intent.intent === "CREATE_MEMORY" || intent.intent === "UNKNOWN") {
      return {
        memoryItemId: memoryItem.id,
        lifeEventName,
        openCycle: null,
        closedCycleTitle: null,
        intent,
        classificationStatus: "memory_only"
      };
    }

    if (intent.intent === "CREATE_OPEN_CYCLE") {
      const draft = await classifyInput({
        text: normalized.text,
        locale: normalized.language ?? "ru"
      });

      await saveOpenCycle({
        userId: params.userId,
        memoryItemId: memoryItem.id,
        rawInput: normalized.text,
        draft,
        rawOutput: {
          intent,
          openCycle: draft
        }
      });

      return {
        memoryItemId: memoryItem.id,
        lifeEventName,
        openCycle: draft,
        closedCycleTitle: null,
        intent,
        classificationStatus: "saved"
      };
    }

    return {
      memoryItemId: memoryItem.id,
      lifeEventName,
      openCycle: null,
      closedCycleTitle: null,
      intent,
      classificationStatus: "unsupported_intent"
    };
  } catch (error) {
    console.error("LLM intent/classification failed after MemoryItem save:", error);

    return {
      memoryItemId: memoryItem.id,
      lifeEventName,
      openCycle: null,
      closedCycleTitle: null,
      intent: null,
      classificationStatus: "failed"
    };
  }
}