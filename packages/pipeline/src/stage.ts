// A stage reads artifacts, calls ports it gets through ctx, writes artifacts. It never knows paths or adapters.
import type { Library } from "@vf/contracts";
import type { ArtifactStore, Config, LlmUsage, Logger } from "@vf/core";

export type StageContext<Deps> = {
  runId: string;
  seed: string;
  store: ArtifactStore;
  config: Config;
  library: Library;
  log: Logger;
  deps: Deps;
  // run parameters the CLI passed (format, series, idea...); part of the cache key
  params: Record<string, string>;
  recordUsage: (u: LlmUsage & { stage?: string }) => void;
};

export type StageDef<Deps> = {
  name: string;
  version: number;
  inputs: readonly string[]; // artifact names this stage reads
  outputs: readonly string[]; // artifact names this stage writes (all must exist afterwards)
  // data the stage reads besides its input artifacts (library entries); part of the cache key, so an edit re-runs it
  fingerprint?: (ctx: StageContext<Deps>) => unknown;
  run: (ctx: StageContext<Deps>) => Promise<void>;
};

// Identity helper for inference; keeps call sites short and typed.
export const stage = <Deps>(def: StageDef<Deps>): StageDef<Deps> => def;
