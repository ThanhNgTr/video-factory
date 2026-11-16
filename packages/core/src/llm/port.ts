// The LLM port: structured JSON in, structured JSON out. Adapters: anthropic (SDK), claude-cli, fake.
import type { z } from "zod";

export type LlmModel = "opus" | "sonnet" | "haiku";
export type LlmImage = { path: string };

export type LlmRequest = {
  model: LlmModel;
  system: string;
  user: string;
  images?: LlmImage[];
  schema: z.ZodType; // zod schema; adapters convert to JSON Schema
  schemaName: string;
  maxTokens?: number;
};

export type LlmUsage = {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  ms: number;
  provider: string;
  model: string;
};
export type LlmResult = { value: unknown; usage: LlmUsage };

export interface Llm {
  json(req: LlmRequest): Promise<LlmResult>;
}
