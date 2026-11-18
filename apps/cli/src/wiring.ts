// Composition root: the only place adapters are chosen (roadmap §4.8). Everything else receives them through ctx.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type AssetsDeps, FfmpegRasterizer } from "@vf/assets";
import type { AudioDeps } from "@vf/audio";
import { EdgeTts, FakeTts } from "@vf/audio";
import {
  AnthropicLlm,
  ArtifactStore,
  ClaudeCliLlm,
  CodexCliLlm,
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
import { RemotionSnapshot } from "./snapshot.ts";

export type Deps = ScriptDeps & AssetsDeps & AudioDeps & VideoDeps;

export const ROOT = new URL("../../..", import.meta.url).pathname;
const FAKE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="200" fill="#ffd60a" stroke="#1d1b22" stroke-width="12"/><circle cx="200" cy="210" r="24" fill="#1d1b22"/><circle cx="312" cy="210" r="24" fill="#1d1b22"/></svg>';

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
      return new FakeLlm({
        script: fixture("script"),
        scene: fixture("scene"),
        formula: fixture("formula"),
        format: fixture("format"),
        "script-review": fixture("script-review"),
        "frame-review": { defects: [] },
        icon: { svg: FAKE_ICON },
        "icon-guess": { guess: "a simple test shape", confidence: 9 },
        "icon-gate": { recognizable: 9, defects: [] },
        scout: { newSets: [] },
        "design-gate": { recognizable: 9, defects: [] },
      });
    }
  }
}

export function wire(overrides: Partial<Deps> = {}) {
  const config = loadConfig(ROOT);
  const log = createLogger(config.logLevel);
  const library = loadLibrary(config.libraryDir);
  mkdirSync(config.runsDir, { recursive: true });
  const state = new RunState(join(config.runsDir, "state.sqlite"));
  const llm = overrides.llm ?? buildLlm(config);
  const renderer = overrides.renderer ?? new RemotionRenderer();
  const deps: Deps = {
    llm,
    // a fake LLM reviews too, so tests and VF_LLM=fake never reach a paid reviewer
    reviewers: [
      ...(config.reviewers.includes("claude") || config.llm === "fake" ? [{ name: "claude", llm }] : []),
      ...(config.reviewers.includes("codex") && config.llm !== "fake" && !overrides.llm
        ? [{ name: "codex", llm: new CodexCliLlm(config.codexBin ?? "codex") }]
        : []),
    ],
    tts:
      config.tts === "edge"
        ? new EdgeTts(join(ROOT, "tools/python/edge_tts_words.py"), join(config.runsDir, ".tts-cache"))
        : new FakeTts(),
    renderer,
    rasterizer: new FfmpegRasterizer(),
    snapshot: new RemotionSnapshot(renderer), // pictures designs with whichever renderer this run uses
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
