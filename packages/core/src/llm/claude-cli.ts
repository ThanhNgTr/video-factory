// Headless Claude Code CLI with --json-schema: structured output billed to the logged-in account.
// shortcut: no API key is provisioned yet; set VF_LLM=anthropic once one exists (batch, caching, rate limits).
import { spawn } from "node:child_process";
import { z } from "zod";
import { StageError } from "../errors.ts";
import type { Llm, LlmRequest, LlmResult } from "./port.ts";

// spawn with stdin closed: the CLI waits 3 s for piped stdin otherwise
function run(bin: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (d: string) => {
      stdout += d;
    });
    child.stderr.setEncoding("utf8").on("data", (d: string) => {
      stderr += d;
    });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(Object.assign(new Error(`exit ${code}`), { stderr, stdout }));
    });
  });
}

const Out = z.object({
  is_error: z.boolean().optional(),
  result: z.unknown().optional(),
  structured_output: z.unknown().optional(),
  total_cost_usd: z.number().optional(),
  usage: z.object({ input_tokens: z.number().optional(), output_tokens: z.number().optional() }).optional(),
});

export class ClaudeCliLlm implements Llm {
  private readonly bin: string;
  private readonly maxBudgetUsd: number;
  constructor(bin: string, maxBudgetUsd: number) {
    this.bin = bin;
    this.maxBudgetUsd = maxBudgetUsd;
  }

  async json(req: LlmRequest): Promise<LlmResult> {
    // the CLI validator rejects the draft-2020-12 `$schema` marker zod emits
    const { $schema: _draft, ...schema } = z.toJSONSchema(req.schema, { io: "input" });
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
          "--max-budget-usd",
          String(this.maxBudgetUsd),
        ],
        20 * 60_000,
      ));
    } catch (e) {
      const err = e as Error & { stderr?: string };
      throw new StageError("provider-failed", `claude cli failed: ${err.stderr?.slice(0, 2000) || err.message}`, {
        cause: e,
      });
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
