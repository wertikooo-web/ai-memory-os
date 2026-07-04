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

export type SaveOrUpdateOpenCycleResult =
  | {
      status: "created";
      cycle: Awaited<ReturnType<typeof saveOpenCycle>>;
      duplicateOf: null;
    }
  | {
      status: "updated";
      cycle: Awaited<ReturnType<typeof saveOpenCycle>>;
      duplicateOf: string;
    };

export async function saveOrUpdateSimilarOpenCycle(params: {
  userId: string;
  memoryItemId?: string;
  rawInput?: string;
  draft: OpenCycleDraft;
  rawOutput?: unknown;
}): Promise<SaveOrUpdateOpenCycleResult> {
  const duplicate = await findSimilarOpenCycle({
    userId: params.userId,
    draft: params.draft
  });

  if (!duplicate) {
    const cycle = await saveOpenCycle(params);
    return {
      status: "created",
      cycle,
      duplicateOf: null
    };
  }

  const cycle = await prisma.openCycle.update({
    where: { id: duplicate.id },
    data: mergeOpenCycleData({
      existing: duplicate,
      draft: params.draft,
      rawInput: params.rawInput,
      rawOutput: params.rawOutput
    })
  });

  return {
    status: "updated",
    cycle,
    duplicateOf: duplicate.id
  };
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
export type DuplicateOpenCyclePair = {
  keep: DuplicateOpenCycle;
  duplicate: DuplicateOpenCycle;
  score: number;
};

export type DuplicateOpenCycle = {
  id: string;
  type: OpenCycleType;
  title: string;
  context: string | null;
  area: string | null;
  urgency: number | null;
  importance: number | null;
  energy: number | null;
  estimatedMinutes: number | null;
  dueDate: Date | null;
  reason: string | null;
  createdAt: Date;
};

export async function findFirstDuplicateOpenCyclePair(userId: string): Promise<DuplicateOpenCyclePair | null> {
  const cycles = await prisma.openCycle.findMany({
    where: {
      userId,
      closedAt: null
    },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      type: true,
      title: true,
      context: true,
      area: true,
      urgency: true,
      importance: true,
      energy: true,
      estimatedMinutes: true,
      dueDate: true,
      reason: true,
      createdAt: true
    }
  });

  let best: DuplicateOpenCyclePair | null = null;

  for (let leftIndex = 0; leftIndex < cycles.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < cycles.length; rightIndex += 1) {
      const left = cycles[leftIndex];
      const right = cycles[rightIndex];

      if (!areCompatibleOpenCycleTypes(left.type, right.type)) {
        continue;
      }

      const score = titleSimilarity(toComparableTokens(left.title), toComparableTokens(right.title));
      if (score < 0.86) {
        continue;
      }

      const pair = buildDuplicatePair(left, right, score);
      if (!best || pair.score > best.score) {
        best = pair;
      }
    }
  }

  return best;
}

export async function mergeDuplicateOpenCycles(params: {
  userId: string;
  keepOpenCycleId: string;
  duplicateOpenCycleId: string;
}) {
  if (params.keepOpenCycleId === params.duplicateOpenCycleId) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const cycles = await tx.openCycle.findMany({
      where: {
        userId: params.userId,
        id: {
          in: [params.keepOpenCycleId, params.duplicateOpenCycleId]
        },
        closedAt: null
      },
      select: {
        id: true,
        type: true,
        title: true,
        context: true,
        area: true,
        urgency: true,
        importance: true,
        energy: true,
        estimatedMinutes: true,
        dueDate: true,
        reason: true,
        rawInput: true,
        rawOutput: true,
        createdAt: true
      }
    });

    const keep = cycles.find((cycle) => cycle.id === params.keepOpenCycleId);
    const duplicate = cycles.find((cycle) => cycle.id === params.duplicateOpenCycleId);

    if (!keep || !duplicate || !areCompatibleOpenCycleTypes(keep.type, duplicate.type)) {
      return null;
    }

    const similarity = titleSimilarity(toComparableTokens(keep.title), toComparableTokens(duplicate.title));
    if (similarity < 0.86) {
      return null;
    }

    const updated = await tx.openCycle.update({
      where: { id: keep.id },
      data: {
        type: chooseType(keep.type, duplicate.type),
        title: chooseTitle(keep.title, duplicate.title),
        context: keep.context ?? duplicate.context,
        area: keep.area ?? duplicate.area,
        urgency: maxNullable(keep.urgency, duplicate.urgency),
        importance: maxNullable(keep.importance, duplicate.importance),
        energy: minNullable(keep.energy, duplicate.energy),
        estimatedMinutes: keep.estimatedMinutes ?? duplicate.estimatedMinutes,
        dueDate: keep.dueDate ?? duplicate.dueDate,
        reason: keep.reason ?? duplicate.reason,
        rawInput: appendRawInput(keep.rawInput, duplicate.rawInput ?? undefined),
        rawOutput: JSON.parse(JSON.stringify({
          previous: keep.rawOutput ?? null,
          mergedDuplicate: duplicate.rawOutput ?? null,
          dedupe: {
            duplicateOpenCycleId: duplicate.id,
            duplicateTitle: duplicate.title,
            similarity
          }
        }))
      }
    });

    await tx.openCycle.update({
      where: { id: duplicate.id },
      data: { closedAt: new Date() }
    });

    return {
      keep: updated,
      duplicate,
      score: similarity
    };
  });
}

type SimilarOpenCycle = {
  id: string;
  type: OpenCycleType;
  title: string;
  context: string | null;
  area: string | null;
  urgency: number | null;
  importance: number | null;
  energy: number | null;
  estimatedMinutes: number | null;
  dueDate: Date | null;
  reason: string | null;
  rawInput: string | null;
  rawOutput: unknown;
};

async function findSimilarOpenCycle(params: {
  userId: string;
  draft: OpenCycleDraft;
}): Promise<SimilarOpenCycle | null> {
  if (!isDedupeCandidateType(params.draft.type)) {
    return null;
  }

  const candidates = await prisma.openCycle.findMany({
    where: {
      userId: params.userId,
      closedAt: null,
      type: {
        in: getCompatibleTypes(params.draft.type)
      }
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      title: true,
      context: true,
      area: true,
      urgency: true,
      importance: true,
      energy: true,
      estimatedMinutes: true,
      dueDate: true,
      reason: true,
      rawInput: true,
      rawOutput: true
    }
  });

  const draftTokens = toComparableTokens(params.draft.title);
  if (draftTokens.length === 0) {
    return null;
  }

  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: titleSimilarity(draftTokens, toComparableTokens(candidate.title))
    }))
    .filter((item) => item.score >= 0.86)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.candidate ?? null;
}

function mergeOpenCycleData(params: {
  existing: SimilarOpenCycle;
  draft: OpenCycleDraft;
  rawInput?: string;
  rawOutput?: unknown;
}) {
  const mergedRawOutput = {
    previous: params.existing.rawOutput ?? null,
    update: params.rawOutput ?? null,
    dedupe: {
      matchedOpenCycleId: params.existing.id,
      matchedTitle: params.existing.title
    }
  };

  return {
    type: chooseType(params.existing.type, toPrismaOpenCycleType(params.draft.type)),
    title: chooseTitle(params.existing.title, params.draft.title),
    context: params.draft.context ?? params.existing.context,
    area: params.draft.area ?? params.existing.area,
    urgency: maxNullable(params.existing.urgency, params.draft.urgency),
    importance: maxNullable(params.existing.importance, params.draft.importance),
    energy: minNullable(params.existing.energy, params.draft.energy),
    estimatedMinutes: params.draft.estimatedMinutes ?? params.existing.estimatedMinutes,
    dueDate: parseDueDate(params.draft.dueDate) ?? params.existing.dueDate,
    reason: params.draft.reason ?? params.existing.reason,
    rawInput: appendRawInput(params.existing.rawInput, params.rawInput),
    rawOutput: JSON.parse(JSON.stringify(mergedRawOutput))
  };
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

function isDedupeCandidateType(type: OpenCycleDraft["type"]): boolean {
  return ["TASK", "PURCHASE", "PROMISE", "IDEA", "OTHER"].includes(type);
}

function getCompatibleTypes(type: OpenCycleDraft["type"]): OpenCycleType[] {
  if (type === "TASK" || type === "PURCHASE") {
    return [OpenCycleType.TASK, OpenCycleType.PURCHASE];
  }

  return [toPrismaOpenCycleType(type)];
}

function areCompatibleOpenCycleTypes(left: OpenCycleType, right: OpenCycleType): boolean {
  if ((left === OpenCycleType.TASK || left === OpenCycleType.PURCHASE) && (right === OpenCycleType.TASK || right === OpenCycleType.PURCHASE)) {
    return true;
  }

  return left === right;
}

function buildDuplicatePair(left: DuplicateOpenCycle, right: DuplicateOpenCycle, score: number): DuplicateOpenCyclePair {
  const keep = chooseDuplicateKeeper(left, right);
  const duplicate = keep.id === left.id ? right : left;

  return {
    keep,
    duplicate,
    score
  };
}

function chooseDuplicateKeeper(left: DuplicateOpenCycle, right: DuplicateOpenCycle): DuplicateOpenCycle {
  const leftHasDueDate = left.dueDate ? 1 : 0;
  const rightHasDueDate = right.dueDate ? 1 : 0;
  if (leftHasDueDate !== rightHasDueDate) {
    return leftHasDueDate > rightHasDueDate ? left : right;
  }

  const leftScore = (left.urgency ?? 0) + (left.importance ?? 0);
  const rightScore = (right.urgency ?? 0) + (right.importance ?? 0);
  if (leftScore !== rightScore) {
    return leftScore > rightScore ? left : right;
  }

  return left.createdAt <= right.createdAt ? left : right;
}

function toComparableTokens(title: string): string[] {
  const stopwords = new Set([
    "и",
    "в",
    "во",
    "на",
    "по",
    "для",
    "про",
    "к",
    "ко",
    "с",
    "со",
    "у",
    "от",
    "до",
    "надо",
    "нужно",
    "нужн",
    "купить",
    "купи",
    "куплю",
    "купил",
    "купила",
    "купили",
    "заказать",
    "закажи",
    "сделать",
    "сделай",
    "написать",
    "напиши",
    "ответить",
    "позвонить",
    "сегодня",
    "завтра",
    "вечером",
    "утром"
  ]);

  return title
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^a-zа-я0-9\s]/gi, " ")
    .split(/\s+/)
    .map((token) => normalizeToken(token))
    .filter((token) => token.length >= 3 && !stopwords.has(token));
}

function normalizeToken(token: string): string {
  let value = token.trim();

  for (const ending of ["ами", "ями", "ого", "ему", "ому", "ыми", "ими", "ый", "ий", "ая", "яя", "ое", "ее", "ов", "ев", "ей", "ам", "ям", "ах", "ях", "ом", "ем", "ой", "ей", "ые", "ие", "ы", "и", "а", "я", "о", "е", "ь"]) {
    if (value.length > ending.length + 3 && value.endsWith(ending)) {
      value = value.slice(0, -ending.length);
      break;
    }
  }

  return value;
}

function titleSimilarity(leftTokens: string[], rightTokens: string[]): number {
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;

  return union === 0 ? 0 : intersection / union;
}

function chooseType(existing: OpenCycleType, draft: OpenCycleType): OpenCycleType {
  if (existing === OpenCycleType.TASK && draft === OpenCycleType.PURCHASE) {
    return OpenCycleType.PURCHASE;
  }

  if (existing === OpenCycleType.OTHER && draft !== OpenCycleType.OTHER) {
    return draft;
  }

  return existing;
}

function chooseTitle(existing: string, draft: string): string {
  return draft.length > existing.length ? draft : existing;
}

function maxNullable(left: number | null, right: number | null): number | null {
  if (left === null) {
    return right;
  }

  if (right === null) {
    return left;
  }

  return Math.max(left, right);
}

function minNullable(left: number | null, right: number | null): number | null {
  if (left === null) {
    return right;
  }

  if (right === null) {
    return left;
  }

  return Math.min(left, right);
}

function appendRawInput(existing: string | null, next?: string): string | undefined {
  if (!existing) {
    return next;
  }

  if (!next || existing.includes(next)) {
    return existing;
  }

  return [existing, next].join("\n--- update ---\n");
}
