import { z } from "zod";

const ServerEnvironmentSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  LLM_PROVIDER: z.literal("openai").default("openai"),
  LLM_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().min(1),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
  APP_BASE_URL: z.string().url(),
});

export type ServerEnvironment = z.infer<typeof ServerEnvironmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= ServerEnvironmentSchema.parse(process.env);
  return cachedEnvironment;
}
