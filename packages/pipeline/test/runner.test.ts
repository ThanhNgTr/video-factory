import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Library } from "@vf/contracts";
import { ArtifactStore, createLogger, loadConfig, StageError } from "@vf/core";
import { afterAll, describe, expect, it } from "vitest";
import { runStages } from "../src/runner.ts";
import { type StageContext, stage } from "../src/stage.ts";
import { RunState } from "../src/state.ts";

const tmp = mkdtempSync(join(tmpdir(), "vf-runner-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const emptyLib: Library = {
  people: {},
  actions: {},
  sets: {},
  formulas: {},
  formats: {},
  series: {},
  music: {},
  sfx: {},
  icons: {},
  premises: {},
};
const ctxFor = (runId: string, params: Record<string, string> = {}): StageContext<undefined> => ({
  runId,
  seed: runId,
  store: new ArtifactStore(join(tmp, runId)),
  config: loadConfig(tmp),
  library: emptyLib,
  log: createLogger("silent"),
  deps: undefined,
  params,
  recordUsage: () => undefined,
});

describe("runStages", () => {
  it("caches by input hash, re-runs after an input changes, resumes after a failure", async () => {
    const state = new RunState(join(tmp, "s.sqlite"));
    let aRuns = 0;
    let bRuns = 0;
    let failB = true;
    const a = stage<undefined>({
      name: "a",
      version: 1,
      inputs: [],
      outputs: ["a.json"],
      run: async (c) => {
        aRuns++;
        c.store.writeJson("a.json", { n: aRuns });
      },
    });
    const b = stage<undefined>({
      name: "b",
      version: 1,
      inputs: ["a.json"],
      outputs: ["b.json"],
      run: async (c) => {
        bRuns++;
        if (failB) throw new StageError("invalid-output", "bad data");
        c.store.writeJson("b.json", { ok: true });
      },
    });
    const ctx = ctxFor("r1");
    await expect(runStages(ctx, state, [a, b])).rejects.toThrow("bad data");
    expect(state.getRun("r1")?.status).toBe("failed");
    expect(state.stageRow("r1", "b")?.status).toBe("failed");

    failB = false;
    await runStages(ctx, state, [a, b]); // resume: a is cached, b runs
    expect([aRuns, bRuns]).toEqual([1, 2]);
    expect(state.getRun("r1")?.status).toBe("done");

    ctx.store.writeJson("a.json", { edited: true }); // a human edit changes b's input hash
    await runStages(ctx, state, [a, b]);
    expect([aRuns, bRuns]).toEqual([1, 3]);
    state.close();
  });

  it("re-runs a stage when the library data it reads changes, and only that stage", async () => {
    const state = new RunState(join(tmp, "s.sqlite"));
    let runs = 0;
    const inline = stage<undefined>({
      name: "inline",
      version: 1,
      inputs: [],
      outputs: ["inline.json"],
      fingerprint: (c) => c.library.sets,
      run: async (c) => {
        runs++;
        c.store.writeJson("inline.json", {});
      },
    });
    const ctx = ctxFor("r-lib");
    await runStages(ctx, state, [inline]);
    await runStages(ctx, state, [inline]);
    expect(runs).toBe(1);
    const edited = { ...ctx, library: { ...emptyLib, sets: { s: {} } } as unknown as Library };
    await runStages(edited, state, [inline]);
    expect(runs).toBe(2);
    state.close();
  });
  it("retries transient errors with backoff and records cost", async () => {
    const state = new RunState(join(tmp, "s2.sqlite"));
    let tries = 0;
    const flaky = stage<undefined>({
      name: "flaky",
      version: 1,
      inputs: [],
      outputs: ["x.json"],
      run: async (c) => {
        tries++;
        c.recordUsage({ provider: "p", model: "m", inputTokens: 1, outputTokens: 1, costUsd: 0.01, ms: 1 });
        if (tries < 2) throw new StageError("provider-transient", "rate limited", { retryable: true });
        c.store.writeJson("x.json", {});
      },
    });
    await runStages(ctxFor("r2"), state, [flaky]);
    expect(tries).toBe(2);
    expect(state.runCost("r2")).toBeCloseTo(0.02);
    state.close();
  });

  it("stops a run that exceeds the budget", async () => {
    const state = new RunState(join(tmp, "s3.sqlite"));
    const spender = stage<undefined>({
      name: "spender",
      version: 1,
      inputs: [],
      outputs: ["y.json"],
      run: async (c) => {
        c.recordUsage({ provider: "p", model: "m", inputTokens: 1, outputTokens: 1, costUsd: 99, ms: 1 });
        c.store.writeJson("y.json", {});
      },
    });
    const capped = { ...ctxFor("r3"), config: { ...loadConfig(tmp), budgetUsd: 2 } };
    await expect(runStages(capped, state, [spender])).rejects.toMatchObject({ code: "budget-exceeded" });
    // no VF_BUDGET_USD, no cap: the same spend goes through
    await runStages({ ...ctxFor("r3b"), config: { ...loadConfig(tmp), budgetUsd: undefined } }, state, [spender]);
    expect(state.runCost("r3b")).toBe(99);
    state.close();
  });
  it("caps each invocation at the budget, not the run's lifetime spend", async () => {
    const state = new RunState(join(tmp, "budget.sqlite"));
    const spend = (usd: number, name: string) =>
      stage<undefined>({
        name,
        version: 1,
        inputs: [],
        outputs: [`${name}.json`],
        run: async (c) => {
          c.recordUsage({ inputTokens: 0, outputTokens: 0, costUsd: usd, ms: 0, provider: "t", model: "t" });
          c.store.writeJson(`${name}.json`, {});
        },
      });
    const budget = 2;
    const ctx = { ...ctxFor("budget"), config: { ...loadConfig(tmp), budgetUsd: budget } };
    await runStages(ctx, state, [spend(budget * 0.8, "one")]);
    await runStages(ctx, state, [spend(budget * 0.8, "two")]); // lifetime 1.6x, this invocation 0.8x
    expect(state.runCost("budget")).toBeCloseTo(budget * 1.6);
    await expect(runStages(ctx, state, [spend(budget * 1.2, "three")])).rejects.toThrow(/budget/);
    state.close();
  });
});
