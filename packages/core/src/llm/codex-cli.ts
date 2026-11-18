// Headless Codex CLI (`codex exec --output-schema`): structured output billed to the logged-in ChatGPT plan.
// It runs read-only in an empty temp folder, so it sees only the prompt and the attached images.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { StageError } from "../errors.ts";
import type { Llm, LlmRequest, LlmResult } from "./port.ts";
import { run } from "./run.ts";

export class CodexCliLlm implements Llm {
  private readonly bin: string;
  private readonly model: string | undefined;
  constructor(bin: string, model?: string) {
    this.bin = bin;
    this.model = model; // a Codex model id; the request's Claude model name does not apply
  }

  async json(req: LlmRequest): Promise<LlmResult> {
    const dir = mkdtempSync(join(tmpdir(), "vf-codex-"));
    try {
      const { $schema: _draft, ...schema } = z.toJSONSchema(req.schema, { io: "input" });
      writeFileSync(join(dir, "schema.json"), JSON.stringify(strict(schema)));
      const out = join(dir, "out.json");
      const t0 = Date.now();
      try {
        await run(
          this.bin,
          [
            "exec",
            "--ephemeral",
            "--skip-git-repo-check",
            "--color",
            "never",
            "-s",
            "read-only",
            "-C",
            dir,
            "--output-schema",
            join(dir, "schema.json"),
            "-o",
            out,
            ...(this.model ? ["-m", this.model] : []),
            ...(req.images ?? []).flatMap((i) => ["-i", i.path]),
            "--", // `-i` takes several files: the prompt must not be read as one
            `${req.system}\n\n${req.user}`,
          ],
          20 * 60_000,
        );
      } catch (e) {
        const err = e as Error & { stderr?: string };
        throw new StageError("provider-failed", `codex cli failed: ${err.stderr?.slice(-2000) || err.message}`, {
          cause: e,
          retryable: true,
        });
      }
      return {
        value: JSON.parse(readFileSync(out, "utf8")),
        // shortcut: codex exec does not report tokens without --json; parse its events if cost tracking matters
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          ms: Date.now() - t0,
          provider: "codex-cli",
          model: this.model ?? "default",
        },
      };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

// OpenAI strict structured output: every object closed and every property listed as required
export function strict(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strict);
  if (!node || typeof node !== "object") return node;
  const o: Record<string, unknown> = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, strict(v)]));
  if (o.type === "object" && o.properties && typeof o.properties === "object") {
    o.additionalProperties = false;
    o.required = Object.keys(o.properties);
  }
  return o;
}
