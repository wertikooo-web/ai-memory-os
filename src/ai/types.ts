export type OpenCycleType = "TASK" | "THOUGHT" | "PURCHASE" | "IDEA" | "PROMISE" | "NOTE" | "OTHER";

export type NaturalIntentType =
  | "CREATE_MEMORY"
  | "CREATE_OPEN_CYCLE"
  | "CLOSE_OPEN_CYCLE"
  | "DELETE_MEMORY"
  | "UPDATE_MEMORY"
  | "SEARCH_MEMORY"
  | "MOVE_TO_CONTEXT"
  | "UNKNOWN";

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

export type RecentOpenCycleForIntent = {
  id: string;
  type: string;
  title: string;
  context: string | null;
  area: string | null;
  createdAt: string;
};

export type NaturalIntentDraft = {
  intent: NaturalIntentType;
  targetOpenCycleId: string | null;
  targetTitle: string | null;
  confidence: number | null;
  reason: string | null;
};

export type ClassifyInputParams = {
  text: string;
  now?: Date;
  locale?: string;
  timezone?: string;
};

export type ClassifyIntentParams = {
  text: string;
  recentOpenCycles: RecentOpenCycleForIntent[];
  now?: Date;
  locale?: string;
  timezone?: string;
};

export type MorningFocusParams = {
  cycles: OpenCycleDraft[];
  now?: Date;
};