import { classifyInput } from "../ai/classifyInput.js";
import { classifyIntent } from "../ai/classifyIntent.js";
import type { NaturalIntentDraft, OpenCycleDraft } from "../ai/types.js";
import { shouldClassifyWithLlm } from "../config.js";
import { normalizeInput } from "../input/normalize.js";
import { getMemoryItemByOpenCycleId, saveTextMemoryItem } from "./items.js";
import { closeOpenCycleById, listRecentOpenCyclesForIntent, saveOrUpdateSimilarOpenCycle } from "./openCycles.js";

export type DeleteCandidate = {
  memoryItemId: string;
  title: string;
  content: string;
};

export type TextIngestResult = {
  memoryItemId: string;
  lifeEventName: string;
  openCycle: OpenCycleDraft | null;
  closedCycleTitle: string | null;
  updatedCycleTitle: string | null;
  deleteCandidate: DeleteCandidate | null;
  intent: NaturalIntentDraft | null;
  classificationStatus:
    | "disabled"
    | "saved"
    | "updated"
    | "closed"
    | "close_target_not_found"
    | "delete_confirmation"
    | "delete_candidate_not_found"
    | "memory_only"
    | "unsupported_intent"
    | "failed";
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
    return buildResult({
      memoryItemId: memoryItem.id,
      lifeEventName,
      classificationStatus: "disabled"
    });
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
        return buildResult({
          memoryItemId: memoryItem.id,
          lifeEventName,
          closedCycleTitle: closed.title,
          intent,
          classificationStatus: "closed"
        });
      }
    }

    if (intent.intent === "CLOSE_OPEN_CYCLE") {
      return buildResult({
        memoryItemId: memoryItem.id,
        lifeEventName,
        intent,
        classificationStatus: "close_target_not_found"
      });
    }

    if (intent.intent === "DELETE_MEMORY") {
      if (intent.targetOpenCycleId) {
        const candidate = await getMemoryItemByOpenCycleId({
          userId: params.userId,
          openCycleId: intent.targetOpenCycleId
        });

        if (candidate) {
          return buildResult({
            memoryItemId: memoryItem.id,
            lifeEventName,
            deleteCandidate: {
              memoryItemId: candidate.id,
              title: intent.targetTitle ?? candidate.content,
              content: candidate.content
            },
            intent,
            classificationStatus: "delete_confirmation"
          });
        }
      }

      return buildResult({
        memoryItemId: memoryItem.id,
        lifeEventName,
        intent,
        classificationStatus: "delete_candidate_not_found"
      });
    }

    if (intent.intent === "CREATE_MEMORY" || intent.intent === "UNKNOWN") {
      return buildResult({
        memoryItemId: memoryItem.id,
        lifeEventName,
        intent,
        classificationStatus: "memory_only"
      });
    }

    if (intent.intent === "CREATE_OPEN_CYCLE") {
      const draft = await classifyInput({
        text: normalized.text,
        locale: normalized.language ?? "ru"
      });

      const openCycleResult = await saveOrUpdateSimilarOpenCycle({
        userId: params.userId,
        memoryItemId: memoryItem.id,
        rawInput: normalized.text,
        draft,
        rawOutput: {
          intent,
          openCycle: draft
        }
      });

      return buildResult({
        memoryItemId: memoryItem.id,
        lifeEventName,
        openCycle: draft,
        updatedCycleTitle: openCycleResult.status === "updated" ? openCycleResult.cycle.title : null,
        intent,
        classificationStatus: openCycleResult.status === "updated" ? "updated" : "saved"
      });
    }

    return buildResult({
      memoryItemId: memoryItem.id,
      lifeEventName,
      intent,
      classificationStatus: "unsupported_intent"
    });
  } catch (error) {
    console.error("LLM intent/classification failed after MemoryItem save:", error);

    return buildResult({
      memoryItemId: memoryItem.id,
      lifeEventName,
      classificationStatus: "failed"
    });
  }
}

function buildResult(params: {
  memoryItemId: string;
  lifeEventName: string;
  openCycle?: OpenCycleDraft | null;
  closedCycleTitle?: string | null;
  updatedCycleTitle?: string | null;
  deleteCandidate?: DeleteCandidate | null;
  intent?: NaturalIntentDraft | null;
  classificationStatus: TextIngestResult["classificationStatus"];
}): TextIngestResult {
  return {
    memoryItemId: params.memoryItemId,
    lifeEventName: params.lifeEventName,
    openCycle: params.openCycle ?? null,
    closedCycleTitle: params.closedCycleTitle ?? null,
    updatedCycleTitle: params.updatedCycleTitle ?? null,
    deleteCandidate: params.deleteCandidate ?? null,
    intent: params.intent ?? null,
    classificationStatus: params.classificationStatus
  };
}