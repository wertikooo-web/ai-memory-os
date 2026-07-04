import type { OpenCycleDraft } from "../ai/types.js";

type ProjectAlias = {
  context: string;
  aliases: string[];
};

const projectAliases: ProjectAlias[] = [
  {
    context: "AI Memory OS",
    aliases: [
      "ai memory os",
      "ai-memory-os",
      "аи memory os",
      "эй ай memory os",
      "эй ай мемори",
      "эйай мемори",
      "мемори ос",
      "мемори оэс",
      "эмери уэс",
      "memory os",
      "memory оs"
    ]
  },
  {
    context: "VoiceBridge",
    aliases: [
      "voicebridge",
      "voice bridge",
      "войсбридж",
      "войс бридж",
      "воисбридж",
      "воис бридж",
      "войс bridge"
    ]
  },
  {
    context: "Lunara",
    aliases: [
      "lunara",
      "лунара",
      "луна ара",
      "луна-ра",
      "lunara ai",
      "лунара ai",
      "лунара аи"
    ]
  }
];

export function applyProjectContext(draft: OpenCycleDraft, text: string): OpenCycleDraft {
  const project = detectProjectContext(text);
  if (!project) {
    return draft;
  }

  return {
    ...draft,
    context: project,
    area: "project"
  };
}

export function detectProjectContext(text: string): string | null {
  const normalized = normalizeProjectText(text);

  for (const project of projectAliases) {
    if (project.aliases.some((alias) => normalized.includes(normalizeProjectText(alias)))) {
      return project.context;
    }
  }

  return null;
}

function normalizeProjectText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
