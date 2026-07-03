export type OpenCycleType = "TASK" | "THOUGHT" | "PURCHASE" | "IDEA" | "PROMISE" | "NOTE" | "OTHER";

export type OpenCycleDraft = {
  type: OpenCycleType;
  title: string;
  context: string | null;
  area: string | null;
  urgency: number | null;
  importance: number | null;
  energy: number | null;
  estimatedMinutes: number | null;
  dueDate: string | null;
  reason: string | null;
};

export type ClassifyInputParams = {
  text: string;
  now?: Date;
  locale?: string;
  timezone?: string;
};

export type MorningFocusParams = {
  cycles: OpenCycleDraft[];
  now?: Date;
};