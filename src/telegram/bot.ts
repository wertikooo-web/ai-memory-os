import { Bot, Keyboard } from "grammy";
import { config } from "../config.js";
import { listLifeEvents } from "../memory/events.js";
import { ingestTelegramText } from "../memory/ingest.js";
import { deleteLastMemoryItem, getLastMemoryItem } from "../memory/items.js";
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
      await ctx.reply("Открытых циклов пока нет. Отправь текст, и я попробую его разобрать.", {
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

  bot.on("message:voice", async (ctx) => {
    await ctx.reply("🎤 Голос получил. Транскрибация будет позже.", {
      reply_markup: mainKeyboard
    });
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
      "Пока я сохраняю такие фразы безопасно, без автоматического удаления или изменения старых записей."
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