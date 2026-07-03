import "dotenv/config";

export const config = {
  telegramBotToken: process.env.BOT_TOKEN?.trim() ?? process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "",
  databaseUrl: process.env.DATABASE_URL?.trim() ?? ""
};

export function hasRequiredRuntimeConfig(): boolean {
  return Boolean(config.telegramBotToken);
}
