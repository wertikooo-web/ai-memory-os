import { prisma } from "../db/prisma.js";

export async function getOrCreateInboxEvent(userId: string) {
  return prisma.lifeEvent.upsert({
    where: {
      userId_name: {
        userId,
        name: "Inbox"
      }
    },
    update: {},
    create: {
      userId,
      name: "Inbox"
    }
  });
}

export async function listLifeEvents(userId: string) {
  return prisma.lifeEvent.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: { memoryItems: true }
      }
    }
  });
}