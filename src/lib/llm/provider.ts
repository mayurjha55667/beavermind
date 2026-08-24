import "server-only";

import { getServerEnvironment } from "@/lib/env";
import type { LLMProvider } from "@/lib/evaluation/types";
import { OpenAIProvider } from "@/lib/llm/openai-provider";

export function getLLMProvider(): LLMProvider {
  const environment = getServerEnvironment();
  switch (environment.LLM_PROVIDER) {
    case "openai":
      return new OpenAIProvider();
  }
}
