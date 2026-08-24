import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { getServerEnvironment } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import type { LLMProvider } from "@/lib/evaluation/types";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  readonly model: string;
  private readonly client: OpenAI;

  constructor(options?: { apiKey?: string; model?: string; timeoutMs?: number }) {
    const environment = options ? null : getServerEnvironment();
    const apiKey = options?.apiKey ?? environment?.LLM_API_KEY;
    const model = options?.model ?? environment?.LLM_MODEL;
    if (!apiKey || !model) {
      throw new AppError("PROVIDER_FAILURE", {
        details: { message: "LLM_API_KEY and LLM_MODEL must be configured." },
      });
    }
    this.model = model;
    this.client = new OpenAI({
      apiKey,
      timeout: options?.timeoutMs ?? environment?.LLM_TIMEOUT_MS ?? 180_000,
      maxRetries: 0,
    });
  }

  async generateStructured<T>(input: Parameters<LLMProvider["generateStructured"]>[0]) {
    const startedAt = performance.now();
    try {
      const response = await this.client.responses.parse(
        {
          model: this.model,
          instructions: input.system,
          input: input.prompt,
          store: false,
          temperature: 0,
          text: {
            format: zodTextFormat(input.schema, input.schemaName),
          },
          prompt_cache_key: input.idempotencyKey,
        },
        {
          headers: {
            "Idempotency-Key": input.idempotencyKey,
          },
        },
      );

      if (!response.output_parsed) {
        throw new AppError("PROVIDER_FAILURE", {
          details: { responseId: response.id, status: response.status },
          retryable: true,
        });
      }

      const data = input.schema.parse(response.output_parsed) as T;
      return {
        data,
        durationMs: Math.round(performance.now() - startedAt),
        usage: {
          inputTokens: response.usage?.input_tokens ?? null,
          outputTokens: response.usage?.output_tokens ?? null,
          totalTokens: response.usage?.total_tokens ?? null,
        },
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof OpenAI.APIConnectionTimeoutError) {
        throw new AppError("PROVIDER_TIMEOUT", {
          cause: error,
          details: { provider: this.name },
          retryable: true,
        });
      }
      const details =
        error instanceof OpenAI.APIError
          ? { provider: this.name, status: error.status, code: error.code, type: error.type }
          : { provider: this.name, type: error instanceof Error ? error.name : "unknown" };
      throw new AppError("PROVIDER_FAILURE", { cause: error, details, retryable: true });
    }
  }
}
