// Runs stages in order. Cache key = hash(stage + version + input hashes + params). A stage whose key matches and
// whose outputs exist is skipped, so `resume` and a human edit of script.json both do the right thing.
import { hashJson, StageError } from "@vf/core";
import type { StageContext, StageDef } from "./stage.ts";
import type { RunState } from "./state.ts";

const MAX_TRANSIENT_RETRIES = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type RunOptions = { force?: boolean; only?: string; until?: string };

export async function runStages<Deps>(
  ctx: StageContext<Deps>,
  state: RunState,
  stages: readonly StageDef<Deps>[],
  o: RunOptions = {},
): Promise<void> {
  state.upsertRun(ctx.runId, ctx.params, ctx.seed, "running");
  // the budget caps one invocation (a runaway repair loop), not a run's lifetime: a run revised five times
  // must not lock itself out
  const since = state.costMark();
  try {
    for (const s of stages) {
      if (o.only && s.name !== o.only) continue;
      const key = cacheKey(ctx, s);
      const prev = state.stageRow(ctx.runId, s.name);
      const done = prev?.status === "done" && prev.cache_key === key && s.outputs.every((n) => ctx.store.exists(n));
      if (done && !o.force) {
        ctx.log.info({ runId: ctx.runId, stage: s.name }, "cached");
        if (o.until === s.name) return;
        continue;
      }
      await runOne(ctx, state, s, key, since);
      if (o.until === s.name) {
        state.upsertRun(ctx.runId, ctx.params, ctx.seed, "paused");
        return;
      }
    }
    state.upsertRun(ctx.runId, ctx.params, ctx.seed, "done");
  } catch (e) {
    state.upsertRun(ctx.runId, ctx.params, ctx.seed, "failed");
    throw e;
  }
}

function cacheKey<Deps>(ctx: StageContext<Deps>, s: StageDef<Deps>): string {
  const inputs = Object.fromEntries(s.inputs.map((n) => [n, ctx.store.exists(n) ? ctx.store.hash(n) : null]));
  const key = { stage: s.name, version: s.version, inputs, params: ctx.params, seed: ctx.seed };
  // only a stage with a fingerprint gets the extra field: every other stage keeps its key, and its cache
  return hashJson(s.fingerprint ? { ...key, extra: s.fingerprint(ctx) } : key);
}

async function runOne<Deps>(
  ctx: StageContext<Deps>,
  state: RunState,
  s: StageDef<Deps>,
  key: string,
  since: number,
): Promise<void> {
  const log = ctx.log.child({ runId: ctx.runId, stage: s.name });
  const stageCtx: StageContext<Deps> = {
    ...ctx,
    log,
    recordUsage: (u) => {
      state.addCost({ runId: ctx.runId, stage: s.name, ...u });
      const spent = state.runCost(ctx.runId, since);
      const budget = ctx.config.budgetUsd;
      if (budget !== undefined && spent > budget)
        throw new StageError(
          "budget-exceeded",
          `this run of ${ctx.runId} spent $${spent.toFixed(2)} > budget $${budget} (VF_BUDGET_USD)`,
        );
    },
  };
  for (const n of s.inputs) {
    if (!ctx.store.exists(n)) throw new StageError("io", `${s.name}: missing input artifact ${n}`);
  }
  const t0 = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      log.info("start");
      await s.run(stageCtx);
      for (const n of s.outputs) {
        if (!ctx.store.exists(n)) throw new Error(`stage ${s.name} finished without writing ${n}`);
      }
      state.setStage({
        run_id: ctx.runId,
        stage: s.name,
        version: s.version,
        cache_key: key,
        status: "done",
        ms: Date.now() - t0,
        error: null,
      });
      log.info({ ms: Date.now() - t0 }, "done");
      return;
    } catch (e) {
      const retry = e instanceof StageError && e.retryable && attempt < MAX_TRANSIENT_RETRIES;
      const msg = e instanceof Error ? e.message : String(e);
      state.setStage({
        run_id: ctx.runId,
        stage: s.name,
        version: s.version,
        cache_key: key,
        status: retry ? "retrying" : "failed",
        ms: Date.now() - t0,
        error: msg,
      });
      if (!retry) {
        log.error({ err: msg, details: e instanceof StageError ? e.details : undefined }, "failed");
        throw e;
      }
      const wait = 1000 * 2 ** attempt + Math.floor(Math.random() * 500);
      log.warn({ err: msg, wait }, "transient error, retrying");
      await sleep(wait);
    }
  }
}
