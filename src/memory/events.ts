import { prisma } from "../db/prisma.js";

export async function getOrCreateInboxEvent(userId: string) {
  return getOrCreateLifeEvent({
    userId,
    name: "Inbox"
  });
}

export async function getOrCreateLifeEvent(params: { userId: string; name: string }) {
  return prisma.lifeEvent.upsert({
    where: {
      userId_name: {
        userId: params.userId,
        name: params.name
      }
    },
    update: {},
    create: {
      userId: params.userId,
      name: params.name
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
