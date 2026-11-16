// Composition root: the only place adapters are chosen (roadmap §4.8). Everything else receives them through ctx.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AudioDeps } from "@vf/audio";
import { EdgeTts, FakeTts } from "@vf/audio";
import {
  AnthropicLlm,
  ArtifactStore,
  ClaudeCliLlm,
  type Config,
  createLogger,
  FakeLlm,
  type Llm,
  loadConfig,
  loadLibrary,
} from "@vf/core";
import { RunState, type StageContext } from "@vf/pipeline";
import type { ScriptDeps } from "@vf/script";
import { WhisperTranscriber, YtDlpDownloader } from "@vf/script";
import type { VideoDeps } from "@vf/video";
import { RemotionRenderer } from "@vf/video";

export type Deps = ScriptDeps & AudioDeps & VideoDeps;

export const ROOT = new URL("../../..", import.meta.url).pathname;

export function buildLlm(config: Config): Llm {
  switch (config.llm) {
    case "anthropic":
      return new AnthropicLlm(config.anthropicApiKey);
    case "claude-cli":
      return new ClaudeCliLlm(config.claudeBin ?? "claude", config.budgetUsd);
    case "fake": {
      // VF_LLM=fake: answers from evals/fixtures/*.json, so the rest of the line can be exercised for free
      const fixture = (n: string) =>
        JSON.parse(readFileSync(join(ROOT, "evals/fixtures", `${n}.json`), "utf8")) as unknown;
      return new FakeLlm({ script: fixture("script"), scene: fixture("scene"), formula: fixture("formula") });
    }
  }
}

export function wire(overrides: Partial<Deps> = {}) {
  const config = loadConfig(ROOT);
  const log = createLogger(config.logLevel);
  const library = loadLibrary(config.libraryDir);
  mkdirSync(config.runsDir, { recursive: true });
  const state = new RunState(join(config.runsDir, "state.sqlite"));
  const deps: Deps = {
    llm: buildLlm(config),
    tts:
      config.tts === "edge"
        ? new EdgeTts(join(ROOT, "tools/python/edge_tts_words.py"), join(config.runsDir, ".tts-cache"))
        : new FakeTts(),
    renderer: new RemotionRenderer(),
    downloader: new YtDlpDownloader(),
    transcriber: new WhisperTranscriber(join(ROOT, "tools/python/transcribe.py")),
    ...overrides,
  };
  const context = (runId: string, params: Record<string, string>, seed = runId): StageContext<Deps> => ({
    runId,
    seed,
    store: new ArtifactStore(join(config.runsDir, runId)),
    config,
    library,
    log,
    deps,
    params,
    recordUsage: () => undefined, // replaced per stage by the runner
  });
  return { config, log, library, state, deps, context };
}
