import { listOpenCycles } from "./openCycles.js";

export type MorningFocusCycle = {
  id: string;
  type: string;
  title: string;
  context: string | null;
  area: string | null;
  urgency: number | null;
  importance: number | null;
  energy: number | null;
  estimatedMinutes: number | null;
  dueDate: Date | null;
  reason: string | null;
};

export type MorningFocusView = {
  date: string;
  mentalLoad: {
    openCycles: number;
    status: string;
  };
  mainFocus: MorningFocusCycle | null;
  today: MorningFocusCycle[];
  later: MorningFocusCycle[];
  offloaded: MorningFocusCycle[];
  explanation: string[];
};

export async function buildMorningFocus(userId: string, now = new Date()): Promise<MorningFocusView> {
  const cycles = await listOpenCycles(userId, 100);
  const scored = cycles.map((cycle) => ({
    cycle: toMorningFocusCycle(cycle),
    score: scoreCycle(cycle, now),
    isDueTodayOrOverdue: isDueTodayOrOverdue(cycle.dueDate, now),
    isActionable: isActionableType(cycle.type)
  }));

  const actionable = scored
    .filter((item) => item.isActionable)
    .sort((a, b) => b.score - a.score);

  const mainFocus = actionable[0]?.cycle ?? null;
  const mainFocusId = mainFocus?.id ?? null;

  const today = scored
    .filter((item) => item.cycle.id !== mainFocusId)
    .filter((item) => item.isActionable && (item.isDueTodayOrOverdue || item.score >= 12))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.cycle);

  const usedIds = new Set([mainFocusId, ...today.map((cycle) => cycle.id)].filter(Boolean));

  const later = scored
    .filter((item) => !usedIds.has(item.cycle.id))
    .filter((item) => item.isActionable)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.cycle);

  for (const cycle of later) {
    usedIds.add(cycle.id);
  }

  const offloaded = scored
    .filter((item) => !usedIds.has(item.cycle.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((item) => item.cycle);

  return {
    date: now.toISOString().slice(0, 10),
    mentalLoad: {
      openCycles: cycles.length,
      status: buildMentalLoadStatus(cycles.length)
    },
    mainFocus,
    today,
    later,
    offloaded,
    explanation: buildExplanation({
      total: cycles.length,
      mainFocus,
      todayCount: today.length,
      laterCount: later.length,
      offloadedCount: Math.max(0, cycles.length - 1 - today.length - later.length)
    })
  };
}

type OpenCycleRecord = Awaited<ReturnType<typeof listOpenCycles>>[number];

function toMorningFocusCycle(cycle: OpenCycleRecord): MorningFocusCycle {
  return {
    id: cycle.id,
    type: cycle.type,
    title: cycle.title,
    context: cycle.context,
    area: cycle.area,
    urgency: cycle.urgency,
    importance: cycle.importance,
    energy: cycle.energy,
    estimatedMinutes: cycle.estimatedMinutes,
    dueDate: cycle.dueDate,
    reason: cycle.reason
  };
}

function scoreCycle(cycle: OpenCycleRecord, now: Date): number {
  const urgency = cycle.urgency ?? 2;
  const importance = cycle.importance ?? 2;
  const energy = cycle.energy ?? 2;
  const dueBoost = getDueBoost(cycle.dueDate, now);
  const typeBoost = getTypeBoost(cycle.type);
  const lowEnergyBoost = energy <= 2 ? 1 : 0;

  return urgency * 2 + importance * 3 + dueBoost + typeBoost + lowEnergyBoost;
}

function getDueBoost(dueDate: Date | null, now: Date): number {
  if (!dueDate) {
    return 0;
  }

  const dueDay = startOfDay(dueDate).getTime();
  const today = startOfDay(now).getTime();
  const diffDays = Math.round((dueDay - today) / 86_400_000);

  if (diffDays < 0) {
    return 7;
  }

  if (diffDays === 0) {
    return 6;
  }

  if (diffDays === 1) {
    return 3;
  }

  return 0;
}

function getTypeBoost(type: string): number {
  if (type === "PROMISE") {
    return 3;
  }

  if (type === "TASK") {
    return 2;
  }

  if (type === "PURCHASE") {
    return 1;
  }

  return 0;
}

function isActionableType(type: string): boolean {
  return ["TASK", "PURCHASE", "PROMISE", "IDEA", "OTHER"].includes(type);
}

function isDueTodayOrOverdue(dueDate: Date | null, now: Date): boolean {
  if (!dueDate) {
    return false;
  }

  return startOfDay(dueDate).getTime() <= startOfDay(now).getTime();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildMentalLoadStatus(openCycles: number): string {
  if (openCycles === 0) {
    return "В голове тихо: открытых циклов нет.";
  }

  if (openCycles < 10) {
    return `В голове тише: ${openCycles} циклов сохранены.`;
  }

  if (openCycles < 50) {
    return `Система держит нагрузку: ${openCycles} открытых циклов сохранены.`;
  }

  return `Много открытых циклов, но их не нужно держать в голове: ${openCycles} сохранены.`;
}

function buildExplanation(params: {
  total: number;
  mainFocus: MorningFocusCycle | null;
  todayCount: number;
  laterCount: number;
  offloadedCount: number;
}): string[] {
  if (params.total === 0) {
    return ["Открытых циклов нет, поэтому фокус дня пока пустой."];
  }

  const lines = [
    "Я выбрал фокус по срочности, важности, срокам и типу цикла.",
    "Просроченные и сегодняшние циклы получают приоритет.",
    "Обещания и конкретные задачи важнее нейтральных мыслей и заметок."
  ];

  if (params.mainFocus) {
    lines.push(`Главный фокус: ${params.mainFocus.title}.`);
  }

  lines.push(`Сегодня показано ${params.todayCount} дополнительных циклов, ${params.laterCount} отложено на потом, ${params.offloadedCount} можно не держать в голове.`);

  return lines;
}