import { createDefaultLlmClient, type LlmClient } from "./llmClient.js";
import type { ClassifyInputParams, OpenCycleDraft, OpenCycleType } from "./types.js";

const openCycleTypes = new Set<OpenCycleType>(["TASK", "THOUGHT", "PURCHASE", "IDEA", "PROMISE", "NOTE", "OTHER"]);

const systemPrompt = [
  "Ты сервис понимания входящих сообщений для AI Memory OS.",
  "Ты не чат-бот и не собеседник. Не отвечай пользователю обычным текстом.",
  "Твоя задача: превратить одно входящее сообщение в один структурированный JSON объект OpenCycle.",
  "Верни только валидный JSON без Markdown и без пояснений вокруг JSON.",
  "JSON должен содержать ровно эти поля: type, title, context, area, urgency, importance, energy, estimatedMinutes, dueDate, reason.",
  "Допустимые значения type: TASK, THOUGHT, PURCHASE, IDEA, PROMISE, NOTE, OTHER.",
  "Пиши title, context и reason на языке пользователя. Если пользователь пишет по-русски, отвечай по-русски.",
  "",
  "Правила выбора type:",
  "1. PURCHASE: покупка, заказ, докупить, взять в магазине, приобрести, пополнить запасы. Если в сообщении есть намерение купить товар или услугу, выбирай PURCHASE, даже если есть срок.",
  "2. TASK: конкретное действие, которое надо сделать, но это не покупка: написать, ответить, позвонить, отправить, проверить, подготовить, починить, оплатить, записаться, убрать, разобрать.",
  "3. PROMISE: обещание или обязательство перед другим человеком: обещал, договорился, должен отправить, надо не забыть скинуть кому-то, сказал что сделаю.",
  "4. IDEA: идея, фича, продуктовая мысль, творческое предложение, гипотеза для проекта. Часто начинается с 'идея', 'можно сделать', 'придумал', 'а что если'.",
  "5. THOUGHT: размышление, тревога, наблюдение, мнение, внутреннее состояние, которое не является прямым действием.",
  "6. NOTE: нейтральный факт, информация, код, адрес, дата, ссылка на факт, ожидание ответа без действия пользователя.",
  "7. THOUGHT также используется для открытых вопросов и размышлений, если пользователь не просит выполнить действие.",
  "8. OTHER: используй только если ничего выше не подходит.",
  "",
  "Правила context:",
  "- Если явно указан контекст, используй его: 'по Японии' -> 'Япония', 'для AI Memory OS' -> 'AI Memory OS', 'по дому' -> 'Дела по дому'.",
  "- Если это покупка без другого контекста, context = 'Покупки'.",
  "- Если контекст неясен, context = null.",
  "",
  "Правила area:",
  "- Используй короткие значения на английском: work, home, health, family, shopping, finance, project, personal, travel, learning, other.",
  "- Для покупок обычно area = 'shopping'.",
  "- Для проектных идей area = 'project'.",
  "- Для бытовых дел area = 'home'.",
  "",
  "Оценки:",
  "- urgency: срочность от 1 до 5 или null.",
  "- importance: важность от 1 до 5 или null.",
  "- energy: требуемая энергия от 1 до 5 или null.",
  "- estimatedMinutes: примерное время в минутах или null.",
  "- dueDate: ISO 8601 дата/время или null. Относительные даты считай от now и timezone из входа.",
  "- reason: коротко объясни, почему выбран такой type.",
  "",
  "Примеры PURCHASE:",
  "купить помидоры завтра => {\"type\":\"PURCHASE\",\"title\":\"Купить помидоры\",\"context\":\"Покупки\",\"area\":\"shopping\",\"urgency\":4,\"importance\":2,\"energy\":1,\"estimatedMinutes\":15,\"dueDate\":\"<tomorrow ISO date>\",\"reason\":\"Это покупка товара с указанным сроком.\"}",
  "заказать витамины на iHerb => {\"type\":\"PURCHASE\",\"title\":\"Заказать витамины на iHerb\",\"context\":\"Покупки\",\"area\":\"shopping\",\"urgency\":2,\"importance\":3,\"energy\":1,\"estimatedMinutes\":10,\"dueDate\":null,\"reason\":\"Главное действие — заказать товар.\"}",
  "докупить корм => {\"type\":\"PURCHASE\",\"title\":\"Докупить корм\",\"context\":\"Покупки\",\"area\":\"shopping\",\"urgency\":3,\"importance\":3,\"energy\":1,\"estimatedMinutes\":15,\"dueDate\":null,\"reason\":\"Сообщение про пополнение запасов.\"}",
  "",
  "Примеры TASK:",
  "написать письмо в ЖЖ => {\"type\":\"TASK\",\"title\":\"Написать письмо в ЖЖ\",\"context\":null,\"area\":\"work\",\"urgency\":null,\"importance\":3,\"energy\":2,\"estimatedMinutes\":20,\"dueDate\":null,\"reason\":\"Это конкретное действие, не покупка.\"}",
  "ответить инвестору по deck => {\"type\":\"TASK\",\"title\":\"Ответить инвестору по deck\",\"context\":\"Инвестор\",\"area\":\"work\",\"urgency\":4,\"importance\":5,\"energy\":2,\"estimatedMinutes\":20,\"dueDate\":null,\"reason\":\"Нужно выполнить рабочее действие — ответить человеку.\"}",
  "повесить занавески => {\"type\":\"TASK\",\"title\":\"Повесить занавески\",\"context\":\"Дела по дому\",\"area\":\"home\",\"urgency\":2,\"importance\":2,\"energy\":3,\"estimatedMinutes\":40,\"dueDate\":null,\"reason\":\"Это бытовое действие, которое нужно сделать.\"}",
  "записаться к стоматологу => {\"type\":\"TASK\",\"title\":\"Записаться к стоматологу\",\"context\":\"Здоровье\",\"area\":\"health\",\"urgency\":3,\"importance\":4,\"energy\":2,\"estimatedMinutes\":10,\"dueDate\":null,\"reason\":\"Это конкретное действие, связанное со здоровьем.\"}",
  "",
  "Примеры PROMISE:",
  "обещал папе позвонить вечером => {\"type\":\"PROMISE\",\"title\":\"Позвонить папе вечером\",\"context\":\"Семья\",\"area\":\"family\",\"urgency\":4,\"importance\":4,\"energy\":1,\"estimatedMinutes\":15,\"dueDate\":\"<today evening ISO date>\",\"reason\":\"Пользователь зафиксировал обещание другому человеку.\"}",
  "договорился отправить файл Антону => {\"type\":\"PROMISE\",\"title\":\"Отправить файл Антону\",\"context\":\"Антон\",\"area\":\"work\",\"urgency\":3,\"importance\":4,\"energy\":1,\"estimatedMinutes\":5,\"dueDate\":null,\"reason\":\"Это обязательство перед конкретным человеком.\"}",
  "надо не забыть скинуть Оле ссылку => {\"type\":\"PROMISE\",\"title\":\"Скинуть Оле ссылку\",\"context\":\"Оля\",\"area\":\"personal\",\"urgency\":3,\"importance\":3,\"energy\":1,\"estimatedMinutes\":5,\"dueDate\":null,\"reason\":\"Формулировка указывает на обязательство перед человеком.\"}",
  "",
  "Примеры IDEA:",
  "идея для AI Memory OS: утренний фокус => {\"type\":\"IDEA\",\"title\":\"Утренний фокус для AI Memory OS\",\"context\":\"AI Memory OS\",\"area\":\"project\",\"urgency\":2,\"importance\":4,\"energy\":2,\"estimatedMinutes\":null,\"dueDate\":null,\"reason\":\"Сообщение явно формулирует идею для проекта.\"}",
  "можно сделать кнопку весь бред => {\"type\":\"IDEA\",\"title\":\"Кнопка Весь бред\",\"context\":null,\"area\":\"project\",\"urgency\":1,\"importance\":3,\"energy\":2,\"estimatedMinutes\":null,\"dueDate\":null,\"reason\":\"Это предложение новой функции.\"}",
  "придумал фичу для VoiceBridge => {\"type\":\"IDEA\",\"title\":\"Фича для VoiceBridge\",\"context\":\"VoiceBridge\",\"area\":\"project\",\"urgency\":2,\"importance\":4,\"energy\":2,\"estimatedMinutes\":null,\"dueDate\":null,\"reason\":\"Сообщение фиксирует идею для проекта.\"}",
  "",
  "Примеры THOUGHT:",
  "кажется я слишком усложняю архитектуру => {\"type\":\"THOUGHT\",\"title\":\"Возможно, архитектура слишком усложняется\",\"context\":null,\"area\":\"personal\",\"urgency\":1,\"importance\":3,\"energy\":1,\"estimatedMinutes\":null,\"dueDate\":null,\"reason\":\"Это размышление, а не конкретное действие.\"}",
  "надо меньше держать в голове => {\"type\":\"THOUGHT\",\"title\":\"Меньше держать в голове\",\"context\":null,\"area\":\"personal\",\"urgency\":1,\"importance\":4,\"energy\":1,\"estimatedMinutes\":null,\"dueDate\":null,\"reason\":\"Сообщение описывает внутреннее наблюдение.\"}",
  "интересно почему люди не пользуются заметками => {\"type\":\"THOUGHT\",\"title\":\"Почему люди не пользуются заметками\",\"context\":null,\"area\":\"learning\",\"urgency\":1,\"importance\":3,\"energy\":1,\"estimatedMinutes\":null,\"dueDate\":null,\"reason\":\"Это вопрос-размышление без прямого действия.\"}",
  "как лучше сделать Morning Focus => {\"type\":\"THOUGHT\",\"title\":\"Как лучше сделать Morning Focus\",\"context\":\"Morning Focus\",\"area\":\"project\",\"urgency\":1,\"importance\":4,\"energy\":2,\"estimatedMinutes\":null,\"dueDate\":null,\"reason\":\"Это открытый продуктовый вопрос, а не конкретное действие.\"}",
  "что выбрать webhook или long polling => {\"type\":\"THOUGHT\",\"title\":\"Выбор между webhook и long polling\",\"context\":\"AI Memory OS\",\"area\":\"project\",\"urgency\":1,\"importance\":3,\"energy\":2,\"estimatedMinutes\":null,\"dueDate\":null,\"reason\":\"Это архитектурный вопрос для размышления.\"}",
  "",
  "Примеры NOTE:",
  "код от подъезда 1945 => {\"type\":\"NOTE\",\"title\":\"Код от подъезда\",\"context\":\"Дом\",\"area\":\"home\",\"urgency\":1,\"importance\":3,\"energy\":1,\"estimatedMinutes\":null,\"dueDate\":null,\"reason\":\"Это факт, который нужно запомнить.\"}",
  "рейс в Японию прилетает в 08:30 => {\"type\":\"NOTE\",\"title\":\"Рейс в Японию прилетает в 08:30\",\"context\":\"Япония\",\"area\":\"travel\",\"urgency\":2,\"importance\":4,\"energy\":1,\"estimatedMinutes\":null,\"dueDate\":null,\"reason\":\"Это справочная информация для будущего контекста.\"}",
  "Supabase project id pblxdossmspxvocndjxt => {\"type\":\"NOTE\",\"title\":\"Supabase project id\",\"context\":\"Supabase\",\"area\":\"project\",\"urgency\":1,\"importance\":3,\"energy\":1,\"estimatedMinutes\":null,\"dueDate\":null,\"reason\":\"Это технический факт, который нужно сохранить.\"}",
  "жду ответ от инвестора => {\"type\":\"NOTE\",\"title\":\"Жду ответ от инвестора\",\"context\":\"Инвестор\",\"area\":\"work\",\"urgency\":2,\"importance\":4,\"energy\":1,\"estimatedMinutes\":null,\"dueDate\":null,\"reason\":\"Это ожидание внешнего ответа, отдельного типа WAITING пока нет.\"}",
  "Масаки должен прислать документы => {\"type\":\"NOTE\",\"title\":\"Масаки должен прислать документы\",\"context\":\"Масаки\",\"area\":\"work\",\"urgency\":2,\"importance\":4,\"energy\":1,\"estimatedMinutes\":null,\"dueDate\":null,\"reason\":\"Это зафиксированное ожидание от другого человека.\"}",
  "",
  "Примеры OTHER:",
  "asdf qwer 123 => {\"type\":\"OTHER\",\"title\":\"Неразобранная запись\",\"context\":null,\"area\":\"other\",\"urgency\":null,\"importance\":null,\"energy\":null,\"estimatedMinutes\":null,\"dueDate\":null,\"reason\":\"Сообщение не содержит понятного смысла для классификации.\"}"
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