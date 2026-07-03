import { config } from "../config.js";

export type LlmJsonRequest = {
  system: string;
  user: string;
  temperature?: number;
};

export interface LlmProvider {
  generateJson(request: LlmJsonRequest): Promise<unknown>;
}

export class LlmClient {
  constructor(private readonly provider: LlmProvider) {}

  generateJson(request: LlmJsonRequest): Promise<unknown> {
    return this.provider.generateJson(request);
  }
}

export class OpenAiLlmProvider implements LlmProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {}

  async generateJson(request: LlmJsonRequest): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        temperature: request.temperature ?? 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI response did not contain JSON content.");
    }

    return JSON.parse(content) as unknown;
  }
}

export function createDefaultLlmClient(): LlmClient {
  return new LlmClient(new OpenAiLlmProvider(config.openAiApiKey, config.openAiModel));
}