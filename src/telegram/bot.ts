import { Bot, InlineKeyboard, Keyboard } from "grammy";
import { transcribeVoice } from "../ai/transcribeVoice.js";
import { config } from "../config.js";
import { listLifeEvents } from "../memory/events.js";
import { ingestTelegramText } from "../memory/ingest.js";
import { buildMorningFocus, type MorningFocusCycle, type MorningFocusView } from "../memory/morningFocus.js";
import { deleteLastMemoryItem, deleteMemoryItemByIdForUser, getLastMemoryItem } from "../memory/items.js";
import { closeLastOpenCycle, listOpenCycles } from "../memory/openCycles.js";
import { reclassifyLastMemoryItem } from "../memory/reclassify.js";
import { getOrCreateUser } from "../memory/users.js";

const mainKeyboard = new Keyboard()
  .text("/events")
  .text("/last")
  .row()
  .text("/open_cycles")
  .text("/reclassify_last")
  .row()
  .text("/close_cycle")
  .text("/delete_last")
  .resized()
  .persistent();

export function createTelegramBot() {
  const bot = new Bot(config.telegramBotToken);

  bot.command("start", async (ctx) => {
    if (ctx.from) {
      await getOrCreateUser(ctx.from);
    }

    await ctx.reply("🧠 AI Memory OS активирована.", {
      reply_markup: mainKeyboard
    });
  });

  bot.command("last", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    const item = await getLastMemoryItem(user.id);

    if (!item) {
      await ctx.reply("Память пока пустая.", {
        reply_markup: mainKeyboard
      });
      return;
    }

    await ctx.reply([`Последняя запись в ${item.lifeEvent.name}:`, "", item.content].join("\n"), {
      reply_markup: mainKeyboard
    });
  });

  bot.command("today", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    const view = await buildMorningFocus(user.id);

    await ctx.reply(formatMorningFocusView(view), {
      reply_markup: mainKeyboard
    });
  });
  bot.command("events", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    const events = await listLifeEvents(user.id);

    if (events.length === 0) {
      await ctx.reply("Событий пока нет.", {
        reply_markup: mainKeyboard
      });
      return;
    }

    const lines = events.map((event) => `${event.name} — ${event._count.memoryItems} записей`);
    await ctx.reply(["События:", "", ...lines].join("\n"), {
      reply_markup: mainKeyboard
    });
  });

  bot.command("open_cycles", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    const cycles = await listOpenCycles(user.id, 10);

    if (cycles.length === 0) {
      await ctx.reply("Открытых циклов пока нет. Отправь текст или голос, и я попробую его разобрать.", {
        reply_markup: mainKeyboard
      });
      return;
    }

    const lines = cycles.map((cycle, index) => formatOpenCycleLine(index + 1, cycle));
    await ctx.reply(["Открытые циклы:", "", ...lines].join("\n\n"), {
      reply_markup: mainKeyboard
    });
  });

  bot.command("reclassify_last", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    const result = await reclassifyLastMemoryItem(user.id);

    if (result.status === "not_configured") {
      await ctx.reply("LLM-классификация сейчас выключена или не настроен OPENAI_API_KEY.", {
        reply_markup: mainKeyboard
      });
      return;
    }

    if (result.status === "empty") {
      await ctx.reply("Память пока пустая. Нечего переклассифицировать.", {
        reply_markup: mainKeyboard
      });
      return;
    }

    await ctx.reply([
      "♻️ Последняя запись переклассифицирована.",
      `🧠 Теперь это: ${formatOpenCycleType(result.openCycle.type)}.`,
      `Заголовок: ${result.openCycle.title}`,
      result.openCycle.context ? `Контекст: ${result.openCycle.context}` : null,
      result.openCycle.reason ? `Почему: ${result.openCycle.reason}` : null
    ].filter(Boolean).join("\n"), {
      reply_markup: mainKeyboard
    });
  });

  bot.command("close_cycle", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    const closed = await closeLastOpenCycle(user.id);

    if (!closed) {
      await ctx.reply("Открытых циклов пока нет.", {
        reply_markup: mainKeyboard
      });
      return;
    }

    await ctx.reply(`✅ Закрыл цикл: ${closed.title}`, {
      reply_markup: mainKeyboard
    });
  });

  bot.command("delete_last", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    const deletedItem = await deleteLastMemoryItem(user.id);

    if (!deletedItem) {
      await ctx.reply("Память пока пустая.", {
        reply_markup: mainKeyboard
      });
      return;
    }

    await ctx.reply("🗑 Последняя запись удалена.", {
      reply_markup: mainKeyboard
    });
  });

  bot.callbackQuery(/^delete_memory:yes:/, async (ctx) => {
    if (!ctx.from) {
      await ctx.answerCallbackQuery("Не удалось определить пользователя.");
      return;
    }

    const memoryItemId = parseCallbackId(ctx.callbackQuery.data, "delete_memory:yes:");
    if (!memoryItemId) {
      await ctx.answerCallbackQuery("Не понял, что удалять.");
      return;
    }

    const user = await getOrCreateUser(ctx.from);
    const deleted = await deleteMemoryItemByIdForUser({
      userId: user.id,
      memoryItemId
    });

    if (!deleted) {
      await ctx.answerCallbackQuery("Запись уже удалена или не найдена.");
      await ctx.editMessageText("Запись уже удалена или не найдена.").catch(() => undefined);
      return;
    }

    await ctx.answerCallbackQuery("Удалено.");
    await ctx.editMessageText(`🗑 Удалил: ${shorten(deleted.content, 160)}`).catch(() => undefined);
  });

  bot.callbackQuery(/^delete_memory:no:/, async (ctx) => {
    await ctx.answerCallbackQuery("Отменено.");
    await ctx.editMessageText("Ок, не удаляю.").catch(() => undefined);
  });

  bot.on("message:voice", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    try {
      await ctx.api.sendChatAction(ctx.chat.id, "typing");

      const user = await getOrCreateUser(ctx.from);
      const audio = await downloadTelegramVoice(ctx.message.voice.file_id, ctx.message.voice.mime_type ?? "audio/ogg");
      const text = await transcribeVoice({
        audio: audio.data,
        fileName: audio.fileName,
        mimeType: audio.mimeType,
        language: ctx.from.language_code?.startsWith("ru") ? "ru" : undefined
      });

      const result = await ingestTelegramText({
        userId: user.id,
        text,
        telegramMessageId: ctx.message.message_id
      });

      if (result.classificationStatus === "delete_confirmation" && result.deleteCandidate) {
        await ctx.reply([
          "🎤 Распознал:",
          shorten(text, 700),
          "",
          "Нашёл запись:",
          "",
          shorten(result.deleteCandidate.content, 500),
          "",
          "Удалить?"
        ].join("\n"), {
          reply_markup: buildDeleteConfirmationKeyboard(result.deleteCandidate.memoryItemId)
        });
        return;
      }

      await ctx.reply([
        "🎤 Распознал:",
        shorten(text, 700),
        "",
        ...buildIngestReply(result)
      ].join("\n"), {
        reply_markup: mainKeyboard
      });
    } catch (error) {
      console.error("Voice transcription failed:", error);
      await ctx.reply("🎤 Голос получил, но не смог распознать. Попробуй ещё раз или отправь текстом.", {
        reply_markup: mainKeyboard
      });
    }
  });

  bot.on("message:text", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Не удалось определить пользователя.");
      return;
    }

    if (ctx.message.text.startsWith("/")) {
      return;
    }

    const user = await getOrCreateUser(ctx.from);

    const result = await ingestTelegramText({
      userId: user.id,
      text: ctx.message.text,
      telegramMessageId: ctx.message.message_id
    });

    if (result.classificationStatus === "delete_confirmation" && result.deleteCandidate) {
      await ctx.reply([
        "Нашёл запись:",
        "",
        shorten(result.deleteCandidate.content, 500),
        "",
        "Удалить?"
      ].join("\n"), {
        reply_markup: buildDeleteConfirmationKeyboard(result.deleteCandidate.memoryItemId)
      });
      return;
    }

    const replyLines = buildIngestReply(result);

    await ctx.reply(replyLines.join("\n"), {
      reply_markup: mainKeyboard
    });
  });

  bot.catch((error) => {
    console.error("Telegram bot error:", error);
  });

  return bot;
}

type IngestResult = Awaited<ReturnType<typeof ingestTelegramText>>;

type DownloadedVoice = {
  data: ArrayBuffer;
  fileName: string;
  mimeType: string;
};

async function downloadTelegramVoice(fileId: string, mimeType: string): Promise<DownloadedVoice> {
  const file = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/getFile?file_id=${encodeURIComponent(fileId)}`);

  if (!file.ok) {
    const errorText = await file.text();
    throw new Error(`Telegram getFile failed: ${file.status} ${errorText}`);
  }

  const fileData = (await file.json()) as { ok?: boolean; result?: { file_path?: string } };
  const filePath = fileData.result?.file_path;

  if (!fileData.ok || !filePath) {
    throw new Error("Telegram getFile did not return file_path.");
  }

  const response = await fetch(`https://api.telegram.org/file/bot${config.telegramBotToken}/${filePath}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram file download failed: ${response.status} ${errorText}`);
  }

  const extension = filePath.split(".").pop() ?? "ogg";

  return {
    data: await response.arrayBuffer(),
    fileName: `telegram-voice.${extension}`,
    mimeType
  };
}

function buildIngestReply(result: IngestResult): string[] {
  if (result.classificationStatus === "closed" && result.closedCycleTitle) {
    return [
      `✅ Закрыл: ${result.closedCycleTitle}.`,
      "🧠 Понял: это завершение открытого цикла."
    ];
  }

  if (result.classificationStatus === "close_target_not_found") {
    return [
      `✅ Запомнил в ${result.lifeEventName}.`,
      "🧠 Похоже, ты говоришь о завершении дела, но я не нашёл подходящий открытый цикл."
    ];
  }

  if (result.classificationStatus === "delete_candidate_not_found") {
    return [
      `✅ Запомнил в ${result.lifeEventName}.`,
      "🧠 Понял, что ты хочешь удалить запись, но не нашёл достаточно похожую. Пока ничего не удаляю."
    ];
  }

  if (result.classificationStatus === "memory_only") {
    return [
      `✅ Запомнил в ${result.lifeEventName}.`,
      "🧠 Понял: это заметка, без открытого цикла."
    ];
  }

  if (result.classificationStatus === "unsupported_intent" && result.intent) {
    return [
      `✅ Запомнил в ${result.lifeEventName}.`,
      `🧠 Понял намерение: ${formatNaturalIntent(result.intent.intent)}.`,
      "Пока я сохраняю такие фразы безопасно, без автоматического изменения старых записей."
    ];
  }

  const lines = [`✅ Запомнил в ${result.lifeEventName}.`];

  if (result.classificationStatus === "saved" && result.openCycle) {
    lines.push(`🧠 Понял как: ${formatOpenCycleType(result.openCycle.type)}.`);
  }

  if (result.classificationStatus === "failed") {
    lines.push("Разбор через AI временно не сработал, но запись уже сохранена.");
  }

  return lines;
}


function formatMorningFocusView(view: MorningFocusView): string {
  const lines = [
    "Сегодня",
    view.date,
    "",
    view.mentalLoad.status,
    "",
    "Главный фокус дня",
    view.mainFocus ? formatFocusCycle(view.mainFocus) : "Пока нет главного фокуса.",
    "",
    "Сделать сегодня",
    formatFocusList(view.today, "На сегодня ничего не выбрано."),
    "",
    "Если останется время",
    formatFocusList(view.later, "Можно оставить пустым."),
    "",
    "Можно не держать в голове",
    formatFocusList(view.offloaded, "Пока нечего разгружать."),
    "",
    "Почему так",
    ...view.explanation.map((line) => `- ${line}`)
  ];

  return lines.join("\n");
}

function formatFocusList(cycles: MorningFocusCycle[], emptyText: string): string {
  if (cycles.length === 0) {
    return emptyText;
  }

  return cycles.map((cycle, index) => `${index + 1}. ${formatFocusCycle(cycle)}`).join("\n");
}

function formatFocusCycle(cycle: MorningFocusCycle): string {
  const details = [
    formatOpenCycleType(cycle.type),
    cycle.context ? `контекст: ${cycle.context}` : null,
    cycle.dueDate ? `срок: ${cycle.dueDate.toLocaleDateString("ru-RU")}` : null,
    cycle.urgency ? `срочность ${cycle.urgency}` : null,
    cycle.importance ? `важность ${cycle.importance}` : null
  ].filter(Boolean);

  return `${cycle.title}${details.length > 0 ? ` (${details.join(" · ")})` : ""}`;
}
function buildDeleteConfirmationKeyboard(memoryItemId: string) {
  return new InlineKeyboard()
    .text("✅ Да, удалить", `delete_memory:yes:${memoryItemId}`)
    .text("❌ Нет", `delete_memory:no:${memoryItemId}`);
}

function parseCallbackId(data: string, prefix: string): string | null {
  if (!data.startsWith(prefix)) {
    return null;
  }

  const value = data.slice(prefix.length).trim();
  return value.length > 0 ? value : null;
}

function formatOpenCycleLine(index: number, cycle: Awaited<ReturnType<typeof listOpenCycles>>[number]): string {
  const parts = [
    `${index}. ${formatOpenCycleType(cycle.type)}: ${cycle.title}`,
    cycle.context ? `Контекст: ${cycle.context}` : null,
    formatScoreLine(cycle.urgency, cycle.importance, cycle.energy),
    cycle.dueDate ? `Срок: ${cycle.dueDate.toLocaleDateString("ru-RU")}` : null,
    cycle.reason ? `Почему: ${cycle.reason}` : null
  ].filter(Boolean);

  return parts.join("\n");
}

function formatScoreLine(urgency: number | null, importance: number | null, energy: number | null): string | null {
  const scores = [
    urgency ? `срочность ${urgency}` : null,
    importance ? `важность ${importance}` : null,
    energy ? `энергия ${energy}` : null
  ].filter(Boolean);

  return scores.length > 0 ? scores.join(" · ") : null;
}

function formatOpenCycleType(type: string): string {
  const labels: Record<string, string> = {
    TASK: "задача",
    THOUGHT: "мысль",
    PURCHASE: "покупка",
    IDEA: "идея",
    PROMISE: "обещание",
    NOTE: "заметка",
    OTHER: "другое"
  };

  return labels[type] ?? "другое";
}

function formatNaturalIntent(intent: string): string {
  const labels: Record<string, string> = {
    CREATE_MEMORY: "запомнить",
    CREATE_OPEN_CYCLE: "создать открытый цикл",
    CLOSE_OPEN_CYCLE: "закрыть открытый цикл",
    DELETE_MEMORY: "удалить запись",
    UPDATE_MEMORY: "изменить запись",
    SEARCH_MEMORY: "найти в памяти",
    MOVE_TO_CONTEXT: "перенести в контекст",
    UNKNOWN: "непонятно"
  };

  return labels[intent] ?? "непонятно";
}

function shorten(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}