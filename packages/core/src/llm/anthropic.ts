// Claude API adapter: structured outputs via output_config.format, images as base64 blocks, cost from usage.
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { StageError } from "../errors.ts";
import type { Llm, LlmModel, LlmRequest, LlmResult } from "./port.ts";

const MODEL_ID: Record<LlmModel, string> = {
  opus: "claude-opus-5-5",
  sonnet: "claude-sonnet-5-5",
  haiku: "claude-haiku-4-5",
};
// USD per million tokens (input, output). Update with the price list when models change.
const PRICE: Record<LlmModel, [number, number]> = { opus: [4, 20], sonnet: [2, 10], haiku: [1, 5] };
// Structured outputs accept a JSON Schema subset; zod's numeric/length bounds are re-checked by zod anyway.
const UNSUPPORTED = new Set([
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "multipleOf",
  "exclusiveMinimum",
  "exclusiveMaximum",
]);

function sanitize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sanitize);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([k]) => !UNSUPPORTED.has(k))
        .map(([k, val]) => [k, sanitize(val)]),
    );
  }
  return v;
}

const mediaType = (p: string): "image/jpeg" | "image/png" =>
  extname(p).toLowerCase() === ".png" ? "image/png" : "image/jpeg";

export class AnthropicLlm implements Llm {
  private readonly client: Anthropic;
  constructor(apiKey: string | undefined) {
    this.client = apiKey ? new Anthropic({ apiKey }) : new Anthropic();
  }

  async json(req: LlmRequest): Promise<LlmResult> {
    const t0 = Date.now();
    const schema = sanitize(z.toJSONSchema(req.schema, { io: "input" })) as Record<string, unknown>;
    const content: Anthropic.ContentBlockParam[] = [
      ...(req.images ?? []).map(
        (i): Anthropic.ImageBlockParam => ({
          type: "image",
          source: { type: "base64", media_type: mediaType(i.path), data: readFileSync(i.path).toString("base64") },
        }),
      ),
      { type: "text", text: req.user },
    ];
    let res: Anthropic.Message;
    try {
      res = await this.client.messages.create({
        model: MODEL_ID[req.model],
        max_tokens: req.maxTokens ?? 16000,
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        ...(req.model === "haiku" ? {} : { thinking: { type: "adaptive" } }),
        output_config: { format: { type: "json_schema", schema } },
        messages: [{ role: "user", content }],
      });
    } catch (e) {
      const transient =
        e instanceof Anthropic.RateLimitError ||
        e instanceof Anthropic.InternalServerError ||
        e instanceof Anthropic.APIConnectionError;
      throw new StageError(transient ? "provider-transient" : "provider-failed", `anthropic: ${(e as Error).message}`, {
        retryable: transient,
        cause: e,
      });
    }
    if (res.stop_reason === "refusal")
      throw new StageError("provider-failed", `anthropic refused: ${res.stop_details?.explanation ?? ""}`);
    const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      value = { _raw: text };
    }
    const [pin, pout] = PRICE[req.model];
    const cached = res.usage.cache_read_input_tokens ?? 0;
    const inTok = res.usage.input_tokens + cached + (res.usage.cache_creation_input_tokens ?? 0);
    return {
      value,
      usage: {
        inputTokens: inTok,
        outputTokens: res.usage.output_tokens,
        costUsd: (res.usage.input_tokens * pin + cached * pin * 0.1 + res.usage.output_tokens * pout) / 1e6,
        ms: Date.now() - t0,
        provider: "anthropic",
        model: MODEL_ID[req.model],
      },
    };
  }
}
