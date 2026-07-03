import { Bot, Keyboard } from "grammy";
import { config } from "../config.js";
import { listLifeEvents } from "../memory/events.js";
import { deleteLastMemoryItem, getLastMemoryItem, saveTextMemoryItem } from "../memory/items.js";
import { getOrCreateUser } from "../memory/users.js";

const mainKeyboard = new Keyboard()
  .text("/events")
  .text("/last")
  .row()
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

    await saveTextMemoryItem({
      userId: user.id,
      text: ctx.message.text,
      telegramMessageId: ctx.message.message_id
    });

    await ctx.reply("✅ Запомнил в Inbox.", {
      reply_markup: mainKeyboard
    });
  });

  bot.catch((error) => {
    console.error("Telegram bot error:", error);
  });

  return bot;
}