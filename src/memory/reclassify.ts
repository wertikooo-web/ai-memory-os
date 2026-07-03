import { classifyInput } from "../ai/classifyInput.js";
import type { OpenCycleDraft } from "../ai/types.js";
import { shouldClassifyWithLlm } from "../config.js";
import { getLastMemoryItem } from "./items.js";
import { upsertOpenCycleForMemoryItem } from "./openCycles.js";

export type ReclassifyLastResult =
  | { status: "not_configured" }
  | { status: "empty" }
  | { status: "saved"; openCycle: OpenCycleDraft; memoryItemContent: string };

export async function reclassifyLastMemoryItem(userId: string): Promise<ReclassifyLastResult> {
  if (!shouldClassifyWithLlm()) {
    return { status: "not_configured" };
  }

  const item = await getLastMemoryItem(userId);
  if (!item) {
    return { status: "empty" };
  }

  const draft = await classifyInput({
    text: item.content,
    locale: "ru"
  });

  await upsertOpenCycleForMemoryItem({
    userId,
    memoryItemId: item.id,
    rawInput: item.content,
    draft,
    rawOutput: draft
  });

  return {
    status: "saved",
    openCycle: draft,
    memoryItemContent: item.content
  };
}