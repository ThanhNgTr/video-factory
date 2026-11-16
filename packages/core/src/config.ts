// The only file allowed to read process.env (roadmap §4.13). Parsed once at the composition root.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const Config = z.object({
  llm: z.enum(["anthropic", "claude-cli", "fake"]).default("claude-cli"),
  anthropicApiKey: z.string().optional(),
  claudeBin: z.string().optional(),
  models: z
    .object({
      write: z.string().default("opus"),
      direct: z.string().default("sonnet"),
      ingest: z.string().default("opus"),
      review: z.string().default("haiku"),
    })
    .default({ write: "opus", direct: "sonnet", ingest: "opus", review: "haiku" }),
  tts: z.enum(["edge", "fake"]).default("edge"),
  budgetUsd: z.coerce.number().positive().default(2),
  renderConcurrency: z.coerce.number().int().min(1).max(8).default(2),
  runsDir: z.string().default("runs"),
  libraryDir: z.string().default("library"),
  rootDir: z.string(),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  video: z
    .object({ fps: z.literal(30), width: z.literal(1080), height: z.literal(1920) })
    .default({ fps: 30, width: 1080, height: 1920 }),
  audio: z
    .object({
      targetLufs: z.number().default(-14),
      truePeakDb: z.number().default(-1),
      musicDuckDb: z.number().default(-14),
    })
    .default({ targetLufs: -14, truePeakDb: -1, musicDuckDb: -14 }),
});
export type Config = z.infer<typeof Config>;

function loadDotEnv(root: string): Record<string, string> {
  const f = resolve(root, ".env");
  if (!existsSync(f)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m?.[1] && m[2] !== undefined && m[2] !== "") out[m[1]] = m[2];
  }
  return out;
}

export function loadConfig(rootDir: string): Config {
  const env = { ...loadDotEnv(rootDir), ...process.env };
  const anthropicApiKey = env.ANTHROPIC_API_KEY;
  return Config.parse({
    llm: env.VF_LLM ?? (anthropicApiKey ? "anthropic" : undefined),
    anthropicApiKey,
    claudeBin: env.CLAUDE_BIN ?? env.CLAUDE_CODE_EXECPATH,
    tts: env.VF_TTS,
    budgetUsd: env.VF_BUDGET_USD,
    renderConcurrency: env.VF_RENDER_CONCURRENCY,
    runsDir: resolve(rootDir, env.VF_RUNS_DIR ?? "runs"),
    libraryDir: resolve(rootDir, env.VF_LIBRARY_DIR ?? "library"),
    rootDir,
    logLevel: env.VF_LOG_LEVEL,
  });
}
