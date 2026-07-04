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

export async function getMemoryItemByOpenCycleId(params: { userId: string; openCycleId: string }) {
  const cycle = await prisma.openCycle.findFirst({
    where: {
      id: params.openCycleId,
      userId: params.userId
    },
    include: {
      memoryItem: {
        include: {
          lifeEvent: true
        }
      }
    }
  });

  return cycle?.memoryItem ?? null;
}

export async function deleteMemoryItemByIdForUser(params: { userId: string; memoryItemId: string }) {
  const item = await prisma.memoryItem.findFirst({
    where: {
      id: params.memoryItemId,
      userId: params.userId
    },
    include: {
      lifeEvent: true,
      openCycle: true
    }
  });

  if (!item) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.openCycle.deleteMany({
      where: {
        memoryItemId: item.id,
        userId: params.userId
      }
    });

    await tx.memoryItem.delete({
      where: { id: item.id }
    });
  });

  return item;
}

export async function deleteLastMemoryItem(userId: string) {
  const lastItem = await getLastMemoryItem(userId);

  if (!lastItem) {
    return null;
  }

  await deleteMemoryItemByIdForUser({
    userId,
    memoryItemId: lastItem.id
  });

  return lastItem;
}