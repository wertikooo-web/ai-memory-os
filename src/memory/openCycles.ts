import { OpenCycleType } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import type { OpenCycleDraft } from "../ai/types.js";

export async function saveOpenCycle(params: {
  userId: string;
  memoryItemId?: string;
  rawInput?: string;
  draft: OpenCycleDraft;
  rawOutput?: unknown;
}) {
  return prisma.openCycle.create({
    data: {
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
    }
  });
}

export async function listOpenCycles(userId: string, limit = 10) {
  return prisma.openCycle.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      memoryItem: true
    }
  });
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