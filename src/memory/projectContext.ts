import type { OpenCycleDraft } from "../ai/types.js";

type ProjectAlias = {
  context: string;
  area: string;
  aliases: string[];
};

const projectAliases: ProjectAlias[] = [
  {
    context: "AI Memory OS",
    area: "project",
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
    area: "project",
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
    area: "project",
    aliases: [
      "lunara",
      "лунара",
      "луна ара",
      "луна-ра",
      "lunara ai",
      "лунара ai",
      "лунара аи"
    ]
  },
  {
    context: "Домашние дела",
    area: "home",
    aliases: [
      "домашние дела",
      "по дому",
      "дома",
      "дом",
      "быт",
      "бытовое",
      "ремонт",
      "отремонтировать",
      "ремонтировать",
      "починить",
      "починка",
      "чинить",
      "сломалось",
      "сломался",
      "сломалась",
      "пофиксить дома",
      "кран",
      "сантехника",
      "сантехник",
      "унитаз",
      "душ",
      "ванная",
      "кухня",
      "розетка",
      "лампочка",
      "свет",
      "выключатель",
      "дверь",
      "замок",
      "окно",
      "мебель",
      "шкаф",
      "стол",
      "стул",
      "полка",
      "занавески",
      "шторы",
      "уборка",
      "убраться",
      "прибраться",
      "постирать",
      "стирка",
      "посуда",
      "вынести мусор",
      "мусор",
      "пылесос",
      "пылесосить",
      "подъезд",
      "жэк",
      "жкх",
      "управляющая компания"
    ]
  }
];

export function applyProjectContext(draft: OpenCycleDraft, text: string): OpenCycleDraft {
  const context = detectKnownContext(text);
  if (!context) {
    return draft;
  }

  return {
    ...draft,
    context: context.context,
    area: context.area
  };
}

export function detectProjectContext(text: string): string | null {
  return detectKnownContext(text)?.context ?? null;
}

function detectKnownContext(text: string): { context: string; area: string } | null {
  const normalized = normalizeProjectText(text);

  for (const project of projectAliases) {
    if (project.aliases.some((alias) => normalized.includes(normalizeProjectText(alias)))) {
      return {
        context: project.context,
        area: project.area
      };
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
