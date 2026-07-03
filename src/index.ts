import { config, hasRequiredRuntimeConfig } from "./config.js";
import { prisma } from "./db/prisma.js";
import { createTelegramBot } from "./telegram/bot.js";

async function main() {
  if (!hasRequiredRuntimeConfig()) {
    console.log("AI Memory OS MVP is installed.");
    console.log("Set BOT_TOKEN in .env to start the Telegram bot.");
    return;
  }

  if (!config.databaseUrl) {
    console.log("DATABASE_URL is not set. Add it to .env before running the bot.");
    return;
  }

  const bot = createTelegramBot();

  await bot.api.setMyCommands([
    { command: "start", description: "Активировать AI Memory OS" },
    { command: "events", description: "Показать события" },
    { command: "last", description: "Показать последнюю запись" },
    { command: "open_cycles", description: "Показать открытые циклы" },
    { command: "delete_last", description: "Удалить последнюю запись" }
  ]);

  console.log("Starting AI Memory OS Telegram bot...");
  await bot.start();
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });