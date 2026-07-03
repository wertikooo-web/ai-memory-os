import { OpenCycleType } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import type { OpenCycleDraft, RecentOpenCycleForIntent } from "../ai/types.js";

export async function saveOpenCycle(params: {
  userId: string;
  memoryItemId?: string;
  rawInput?: string;
  draft: OpenCycleDraft;
  rawOutput?: unknown;
}) {
  return prisma.openCycle.create({
    data: toOpenCycleData(params)
  });
}

export async function upsertOpenCycleForMemoryItem(params: {
  userId: string;
  memoryItemId: string;
  rawInput?: string;
  draft: OpenCycleDraft;
  rawOutput?: unknown;
}) {
  return prisma.openCycle.upsert({
    where: {
      memoryItemId: params.memoryItemId
    },
    update: {
      ...toOpenCycleData(params),
      closedAt: null
    },
    create: toOpenCycleData(params)
  });
}

export async function listOpenCycles(userId: string, limit = 10) {
  return prisma.openCycle.findMany({
    where: {
      userId,
      closedAt: null
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      memoryItem: true
    }
  });
}

export async function listRecentOpenCyclesForIntent(userId: string, limit = 15): Promise<RecentOpenCycleForIntent[]> {
  const cycles = await prisma.openCycle.findMany({
    where: {
      userId,
      closedAt: null
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      context: true,
      area: true,
      createdAt: true
    }
  });

  return cycles.map((cycle) => ({
    id: cycle.id,
    type: cycle.type,
    title: cycle.title,
    context: cycle.context,
    area: cycle.area,
    createdAt: cycle.createdAt.toISOString()
  }));
}

export async function closeLastOpenCycle(userId: string) {
  const cycle = await prisma.openCycle.findFirst({
    where: {
      userId,
      closedAt: null
    },
    orderBy: { createdAt: "desc" }
  });

  if (!cycle) {
    return null;
  }

  return closeOpenCycleById({ userId, openCycleId: cycle.id });
}

export async function closeOpenCycleById(params: { userId: string; openCycleId: string }) {
  const cycle = await prisma.openCycle.findFirst({
    where: {
      id: params.openCycleId,
      userId: params.userId,
      closedAt: null
    }
  });

  if (!cycle) {
    return null;
  }

  return prisma.openCycle.update({
    where: { id: cycle.id },
    data: { closedAt: new Date() }
  });
}

function toOpenCycleData(params: {
  userId: string;
  memoryItemId?: string;
  rawInput?: string;
  draft: OpenCycleDraft;
  rawOutput?: unknown;
}) {
  return {
    userId: params.userId,
    memoryItemId: params.memoryItemId,
    type: toPrismaOpenCycleType(params.draft.type),
    title: params.draft.title,
    context: params.draft.context,
    area: params.draft.area,
    urgency: params.draft.urgency,
    importance: params.draft.importance,
    energy: params.draft.energy,
    estimatedMinutes: params.draft.estimatedMinutes,
    dueDate: parseDueDate(params.draft.dueDate),
    reason: params.draft.reason,
    rawInput: params.rawInput,
    rawOutput: params.rawOutput === undefined ? undefined : JSON.parse(JSON.stringify(params.rawOutput))
  };
}

function toPrismaOpenCycleType(type: OpenCycleDraft["type"]): OpenCycleType {
  if (type in OpenCycleType) {
    return OpenCycleType[type];
  }

  return OpenCycleType.OTHER;
}

function parseDueDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}