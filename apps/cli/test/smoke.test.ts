// Smoke E2E: the whole MAKE pipeline with fake LLM, TTS and renderer. No network, no Chrome, no money.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FakeTts } from "@vf/audio";
import { Qa } from "@vf/contracts";
import { ArtifactStore, FakeLlm } from "@vf/core";
import { RunState, runStages, type StageContext } from "@vf/pipeline";
import { FakeRenderer } from "@vf/video";
import { afterAll, describe, expect, it } from "vitest";
import { MAKE } from "../src/pipelines.ts";
import { type Deps, wire } from "../src/wiring.ts";

const fixture = (n: string) =>
  JSON.parse(readFileSync(new URL(`../../../evals/fixtures/${n}`, import.meta.url), "utf8")) as unknown;
const tmp = mkdtempSync(join(tmpdir(), "vf-smoke-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("vf make (fakes)", () => {
  it("produces video.mp4, qa.json and a series bible; a second run is fully cached", async () => {
    const llm = new FakeLlm({ script: fixture("script.json"), scene: fixture("scene.json") });
    const w = wire({ llm, tts: new FakeTts(), renderer: new FakeRenderer() });
    const state = new RunState(join(tmp, "state.sqlite"));
    const ctx: StageContext<Deps> = {
      ...w.context("smoke", { format: "skit", series: "smoke-series" }),
      store: new ArtifactStore(join(tmp, "smoke")),
    };

    await runStages(ctx, state, MAKE);
    expect(ctx.store.exists("video.mp4")).toBe(true);
    expect(ctx.store.readJson("qa.json", Qa).pass).toBe(true);
    expect(ctx.store.exists("thumb.jpg")).toBe(true);
    expect(llm.calls.map((c) => c.schemaName)).toEqual(["script", "scene"]);
    expect(state.listStages("smoke").every((s) => s.status === "done")).toBe(true);

    await runStages(ctx, state, MAKE);
    expect(llm.calls).toHaveLength(2); // nothing re-ran
    state.close();
  }, 120_000);
});
