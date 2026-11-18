// Headless Claude Code CLI with --json-schema: structured output billed to the logged-in account.
// shortcut: no API key is provisioned yet; set VF_LLM=anthropic once one exists (batch, caching, rate limits).
import { z } from "zod";
import { StageError } from "../errors.ts";
import type { Llm, LlmRequest, LlmResult } from "./port.ts";
import { run } from "./run.ts";

const Out = z.object({
  is_error: z.boolean().optional(),
  result: z.unknown().optional(),
  structured_output: z.unknown().optional(),
  total_cost_usd: z.number().optional(),
  usage: z.object({ input_tokens: z.number().optional(), output_tokens: z.number().optional() }).optional(),
});

export class ClaudeCliLlm implements Llm {
  private readonly bin: string;
  private readonly maxBudgetUsd: number | undefined;
  constructor(bin: string, maxBudgetUsd?: number) {
    this.bin = bin;
    this.maxBudgetUsd = maxBudgetUsd;
  }

  async json(req: LlmRequest): Promise<LlmResult> {
    const schema = cliSchema(req.schema);
    const images = req.images ?? [];
    const prompt = images.length
      ? `${req.user}\n\nImage files (open EVERY one with the Read tool before answering):\n${images.map((i) => i.path).join("\n")}`
      : req.user;
    const tools = images.length ? "Read" : "";
    const t0 = Date.now();
    let stdout: string;
    try {
      ({ stdout } = await run(
        this.bin,
        [
          "-p",
          prompt,
          "--output-format",
          "json",
          "--json-schema",
          JSON.stringify(schema),
          "--model",
          req.model,
          "--setting-sources",
          "project",
          "--strict-mcp-config",
          "--tools",
          tools,
          ...(tools ? ["--allowedTools", tools] : []),
          "--system-prompt",
          req.system,
          ...(this.maxBudgetUsd !== undefined ? ["--max-budget-usd", String(this.maxBudgetUsd)] : []),
        ],
        20 * 60_000,
      ));
    } catch (e) {
      // the CLI often exits 1 with an empty stderr and its reason in the JSON on stdout
      const err = e as Error & { stderr?: string; stdout?: string };
      const why = err.stderr?.trim() || err.stdout?.trim() || err.message;
      throw new StageError("provider-failed", `claude cli failed: ${why.slice(0, 2000)}`, { cause: e });
    }
    const r = Out.parse(JSON.parse(stdout));
    if (r.is_error)
      throw new StageError("provider-failed", `claude cli: ${String(r.result).slice(0, 2000)}`, { retryable: true });
    const value = r.structured_output ?? (typeof r.result === "string" ? extractJson(r.result) : r.result);
    return {
      value,
      usage: {
        inputTokens: r.usage?.input_tokens ?? 0,
        outputTokens: r.usage?.output_tokens ?? 0,
        costUsd: r.total_cost_usd ?? 0,
        ms: Date.now() - t0,
        provider: "claude-cli",
        model: req.model,
      },
    };
  }
}

// Fallback for CLI builds that return the JSON as text in `result`.
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: text };
  }
}

// Two validators read the schema: the CLI's own (draft-07, strict: `prefixItems` is an unknown keyword) and the API
// (draft 2020-12: an `items` array is invalid). A tuple of one type (a position, a spot) is written as a fixed-length
// array, which both accept; zod still checks the tuple when the answer comes back.
export function cliSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _draft, ...rest } = z.toJSONSchema(schema, { io: "input" });
  return flatTuples(rest) as Record<string, unknown>;
}

function flatTuples(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(flatTuples);
  if (!node || typeof node !== "object") return node;
  const o = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, flatTuples(v)])) as Record<string, unknown>;
  const items = o.prefixItems;
  if (Array.isArray(items) && items.length) {
    const kinds = [...new Set(items.map((i) => JSON.stringify(i)))];
    delete o.prefixItems;
    o.items = kinds.length === 1 ? items[0] : { anyOf: kinds.map((k) => JSON.parse(k)) };
    o.minItems = items.length;
    o.maxItems = items.length;
  }
  return o;
}
