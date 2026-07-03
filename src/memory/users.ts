import type { User as TelegramUser } from "grammy/types";
import { prisma } from "../db/prisma.js";

export async function getOrCreateUser(from: TelegramUser) {
  return prisma.user.upsert({
    where: {
      telegramId: String(from.id)
    },
    update: {
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      languageCode: from.language_code
    },
    create: {
      telegramId: String(from.id),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      languageCode: from.language_code
    }
  });
}
