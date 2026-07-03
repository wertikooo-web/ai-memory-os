import { MemoryItemType } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { getOrCreateInboxEvent } from "./events.js";

export async function saveTextMemoryItem(params: {
  userId: string;
  text: string;
  telegramMessageId?: number;
}) {
  const inbox = await getOrCreateInboxEvent(params.userId);

  return prisma.memoryItem.create({
    data: {
      userId: params.userId,
      lifeEventId: inbox.id,
      type: MemoryItemType.TEXT,
      content: params.text,
      telegramMessageId: params.telegramMessageId
    },
    include: {
      lifeEvent: true
    }
  });
}

export async function getLastMemoryItem(userId: string) {
  return prisma.memoryItem.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      lifeEvent: true
    }
  });
}

export async function deleteLastMemoryItem(userId: string) {
  const lastItem = await getLastMemoryItem(userId);

  if (!lastItem) {
    return null;
  }

  await prisma.memoryItem.delete({
    where: { id: lastItem.id }
  });

  return lastItem;
}