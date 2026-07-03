import { createDefaultLlmClient, type LlmClient } from "./llmClient.js";
import type { ClassifyIntentParams, NaturalIntentDraft, NaturalIntentType } from "./types.js";

const naturalIntentTypes = new Set<NaturalIntentType>([
  "CREATE_MEMORY",
  "CREATE_OPEN_CYCLE",
  "CLOSE_OPEN_CYCLE",
  "DELETE_MEMORY",
  "UPDATE_MEMORY",
  "SEARCH_MEMORY",
  "MOVE_TO_CONTEXT",
  "UNKNOWN"
]);

const systemPrompt = [
  "Ты слой Natural Intent для AI Memory OS.",
  "Твоя задача — понять, что пользователь хочет сделать с памятью, а не отвечать ему как чат-бот.",
  "Верни только валидный JSON без Markdown и без текста вокруг JSON.",
  "JSON должен содержать ровно эти поля: intent, targetOpenCycleId, targetTitle, confidence, reason.",
  "Допустимые intent: CREATE_MEMORY, CREATE_OPEN_CYCLE, CLOSE_OPEN_CYCLE, DELETE_MEMORY, UPDATE_MEMORY, SEARCH_MEMORY, MOVE_TO_CONTEXT, UNKNOWN.",
  "Пиши reason на языке пользователя. Если пользователь пишет по-русски, reason должен быть по-русски.",
  "",
  "Как выбирать intent:",
  "1. CREATE_OPEN_CYCLE — пользователь формулирует новую незавершенную вещь: задачу, покупку, обещание, идею, вопрос или хвост. Примеры: 'купить помидоры', 'написать письмо в ЖЭК', 'позвонить папе'.",
  "2. CLOSE_OPEN_CYCLE — пользователь сообщает, что уже сделал, купил, отправил, написал, решил, закрыл или больше не нужно. Примеры: 'помидоры купил', 'письмо в ЖЭК написал', 'соседа спросил', 'это уже сделал', 'можно закрыть помидоры'.",
  "3. CREATE_MEMORY — пользователь просто фиксирует факт, мысль или заметку без открытого действия. Примеры: 'код от подъезда 1945', 'не нравится красный цвет'.",
  "4. DELETE_MEMORY — пользователь явно просит удалить запись. Примеры: 'удали запись про страуса', 'удали последнее'. Не удаляй сам, только классифицируй intent.",
  "5. UPDATE_MEMORY — пользователь хочет исправить или дополнить старую запись. Примеры: 'исправь, не ЖЭК, а управляющая компания'.",
  "6. SEARCH_MEMORY — пользователь спрашивает, что уже было в памяти. Примеры: 'что я говорил про Японию?', 'покажи всё про помидоры'.",
  "7. MOVE_TO_CONTEXT — пользователь просит перенести или записать в конкретный контекст. Примеры: 'перенеси это в Японию', 'запиши в AI Memory OS'.",
  "8. UNKNOWN — смысл непонятен.",
  "",
  "Правила targetOpenCycleId:",
  "- Если intent = CLOSE_OPEN_CYCLE, выбери самый похожий открытый цикл из recentOpenCycles и верни его id.",
  "- Сравнивай по смыслу, а не только по точным словам: 'помидоры купил' связано с 'Купить помидоры'.",
  "- Если подходящего открытого цикла нет, targetOpenCycleId = null.",
  "- Для остальных intent targetOpenCycleId обычно null, если пользователь явно не ссылается на открытый цикл.",
  "",
  "Примеры:",
  "text='купить помидоры завтра', recentOpenCycles=[] => {\"intent\":\"CREATE_OPEN_CYCLE\",\"targetOpenCycleId\":null,\"targetTitle\":null,\"confidence\":0.95,\"reason\":\"Пользователь формулирует новую покупку.\"}",
  "text='помидоры уже купил', recentOpenCycles=[{id:'abc',title:'Купить помидоры'}] => {\"intent\":\"CLOSE_OPEN_CYCLE\",\"targetOpenCycleId\":\"abc\",\"targetTitle\":\"Купить помидоры\",\"confidence\":0.95,\"reason\":\"Пользователь сообщает, что покупка уже выполнена.\"}",
  "text='письмо в ЖЭК написал', recentOpenCycles=[{id:'def',title:'Написать письмо в ЖЭК'}] => {\"intent\":\"CLOSE_OPEN_CYCLE\",\"targetOpenCycleId\":\"def\",\"targetTitle\":\"Написать письмо в ЖЭК\",\"confidence\":0.94,\"reason\":\"Пользователь сообщает о завершении задачи.\"}",
  "text='удали запись про страуса', recentOpenCycles=[{id:'ghi',title:'Нарисовать страуса'}] => {\"intent\":\"DELETE_MEMORY\",\"targetOpenCycleId\":\"ghi\",\"targetTitle\":\"Нарисовать страуса\",\"confidence\":0.88,\"reason\":\"Пользователь просит удалить запись, но удаление требует отдельного безопасного шага.\"}"
].join("\n");

export async function classifyIntent(
  params: ClassifyIntentParams,
  client: LlmClient = createDefaultLlmClient()
): Promise<NaturalIntentDraft> {
  const now = params.now ?? new Date();
  const raw = await client.generateJson({
    system: systemPrompt,
    user: JSON.stringify({
      text: params.text,
      recentOpenCycles: params.recentOpenCycles,
      now: now.toISOString(),
      locale: params.locale ?? "ru",
      timezone: params.timezone ?? "Europe/Chisinau"
    }),
    temperature: 0.05
  });

  return normalizeNaturalIntent(raw, params.recentOpenCycles.map((cycle) => cycle.id));
}

function normalizeNaturalIntent(raw: unknown, allowedOpenCycleIds: string[]): NaturalIntentDraft {
  if (!isRecord(raw)) {
    throw new Error("LLM intent result must be a JSON object.");
  }

  const intent = normalizeIntent(raw.intent);
  const targetOpenCycleId = normalizeTargetOpenCycleId(raw.targetOpenCycleId, allowedOpenCycleIds);

  return {
    intent,
    targetOpenCycleId,
    targetTitle: normalizeString(raw.targetTitle),
    confidence: normalizeConfidence(raw.confidence),
    reason: normalizeString(raw.reason)
  };
}

function normalizeIntent(value: unknown): NaturalIntentType {
  if (typeof value === "string") {
    const upper = value.trim().toUpperCase() as NaturalIntentType;
    if (naturalIntentTypes.has(upper)) {
      return upper;
    }
  }

  return "UNKNOWN";
}

function normalizeTargetOpenCycleId(value: unknown, allowedOpenCycleIds: string[]): string | null {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  return allowedOpenCycleIds.includes(normalized) ? normalized : null;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeConfidence(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return Math.min(1, Math.max(0, numberValue));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}