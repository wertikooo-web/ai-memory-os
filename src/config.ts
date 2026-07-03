import "dotenv/config";

function readBooleanEnv(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

export const config = {
  telegramBotToken: process.env.BOT_TOKEN?.trim() ?? process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "",
  databaseUrl: process.env.DATABASE_URL?.trim() ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY?.trim() ?? process.env.OPENAI?.trim() ?? "",
  openAiModel: process.env.OPENAI_MODEL?.trim() ?? "gpt-4.1-mini",
  llmClassificationEnabled: readBooleanEnv(process.env.LLM_CLASSIFICATION_ENABLED)
};

export function hasRequiredRuntimeConfig(): boolean {
  return Boolean(config.telegramBotToken);
}

export function hasLlmConfig(): boolean {
  return Boolean(config.openAiApiKey);
}

export function shouldClassifyWithLlm(): boolean {
  return config.llmClassificationEnabled && hasLlmConfig();
}