import { createDefaultLlmClient, type LlmClient } from "./llmClient.js";
import type { ClassifyInputParams, OpenCycleDraft, OpenCycleType } from "./types.js";

const openCycleTypes = new Set<OpenCycleType>(["TASK", "THOUGHT", "PURCHASE", "IDEA", "PROMISE", "NOTE", "OTHER"]);

const systemPrompt = [
  "You are the input understanding service for AI Memory OS.",
  "Your job is not to chat with the user.",
  "Convert one incoming message into one structured OpenCycle JSON object.",
  "Classify whether the message is a task, thought, purchase, idea, promise, note, or other.",
  "Return only valid JSON with these exact keys: type, title, context, area, urgency, importance, energy, estimatedMinutes, dueDate, reason.",
  "Use type values: TASK, THOUGHT, PURCHASE, IDEA, PROMISE, NOTE, OTHER.",
  "Use urgency, importance, and energy as integers from 1 to 5, or null if unknown.",
  "Use estimatedMinutes as an integer number of minutes, or null if unknown.",
  "Use dueDate as ISO 8601 date/time string, or null if no due date is present.",
  "Keep title short and human-readable.",
  "Reason should briefly explain why this classification was chosen."
].join("\n");

export async function classifyInput(
  params: ClassifyInputParams,
  client: LlmClient = createDefaultLlmClient()
): Promise<OpenCycleDraft> {
  const now = params.now ?? new Date();
  const raw = await client.generateJson({
    system: systemPrompt,
    user: JSON.stringify({
      text: params.text,
      now: now.toISOString(),
      locale: params.locale ?? "ru",
      timezone: params.timezone ?? "Europe/Chisinau"
    }),
    temperature: 0.1
  });

  return normalizeOpenCycleDraft(raw);
}

function normalizeOpenCycleDraft(raw: unknown): OpenCycleDraft {
  if (!isRecord(raw)) {
    throw new Error("LLM classification result must be a JSON object.");
  }

  const type = normalizeType(raw.type);

  return {
    type,
    title: normalizeString(raw.title) ?? "Без названия",
    context: normalizeString(raw.context),
    area: normalizeString(raw.area),
    urgency: normalizeScore(raw.urgency),
    importance: normalizeScore(raw.importance),
    energy: normalizeScore(raw.energy),
    estimatedMinutes: normalizePositiveInt(raw.estimatedMinutes),
    dueDate: normalizeString(raw.dueDate),
    reason: normalizeString(raw.reason)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeType(value: unknown): OpenCycleType {
  if (typeof value === "string") {
    const upper = value.trim().toUpperCase() as OpenCycleType;
    if (openCycleTypes.has(upper)) {
      return upper;
    }
  }

  return "OTHER";
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeScore(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return Math.min(5, Math.max(1, Math.round(numberValue)));
}

function normalizePositiveInt(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return null;
  }

  return Math.round(numberValue);
}