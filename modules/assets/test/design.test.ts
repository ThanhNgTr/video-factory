import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Designs } from "@vf/contracts";
import { ArtifactStore, createLogger, FakeLlm, type LlmRequest, loadConfig, loadLibrary } from "@vf/core";
import type { StageContext } from "@vf/pipeline";
import { describe, expect, it } from "vitest";
import { FakeSnapshot } from "../src/adapters/fake-snapshot.ts";
import { FakeRasterizer } from "../src/adapters/ffmpeg-rasterizer.ts";
import type { AssetsDeps } from "../src/ports.ts";
import { assetsDesign, MAX_DESIGNS } from "../src/stages/design.stage.ts";

const root = new URL("../../..", import.meta.url).pathname;
const library = loadLibrary(join(root, "library"));
const clerk = library.people["night-clerk"];
const kitchen = library.sets["diner-kitchen"];

function context(llm: FakeLlm, params: Record<string, string> = {}, cast = ["teacher"]): StageContext<AssetsDeps> {
  const store = new ArtifactStore(mkdtempSync(join(tmpdir(), "vf-design-")));
  store.writeJson("script.json", {
    schemaVersion: 1,
    format: "skit",
    title: "Pop quiz",
    summary: "A teacher hands out a quiz nobody studied for.",
    mood: "bright",
    cast,
    newCast: cast.includes("teacher")
      ? [{ id: "teacher", name: "Ms Park", look: "a strict math teacher, 40s, bun, glasses, cardigan" }]
      : [],
    beats: ["hook", "build", "payoff"].map((role, i) => ({
      id: `b${i}`,
      role,
      action: "In a classroom the teacher slams a stack of quizzes on her desk.",
      cast,
      lines: [],
    })),
    publish: { title: "Pop quiz", description: "d", hashtags: [] },
  });
  return {
    runId: "t",
    seed: "t",
    store,
    config: loadConfig(root),
    library,
    log: createLogger("silent"),
    deps: { llm, rasterizer: new FakeRasterizer(), snapshot: new FakeSnapshot() },
    params,
    recordUsage: () => undefined,
  };
}

describe("assets.design", () => {
  it("designs a new character and a missing place, fixing each from the gate's defects, and keeps the best", async () => {
    // the first set has 2 spots: valid JSON, but it fails checkSetDesign
    const sets = [
      { ...kitchen, id: "x", spots: kitchen?.spots.slice(0, 2) },
      { ...kitchen, id: "x" },
    ];
    let gates = 0;
    const llm = new FakeLlm({
      person: (r: LlmRequest) => ({
        ...clerk,
        id: "whatever",
        voice: { ...clerk?.voice, id: r.user.includes("previous") ? "en-US-JennyNeural" : "en-US-AvaNeural" },
      }),
      scout: { newSets: [{ id: "fixture-classroom", look: "a classroom with desks and a blackboard" }] }, // an id the growing library never has
      set: () => sets.shift() ?? { ...kitchen, id: "x" },
      "design-gate": () =>
        ++gates === 1
          ? { recognizable: 4, defects: ["looks like a waiter, not a teacher"] }
          : { recognizable: 8, defects: [] },
    });
    const ctx = context(llm);
    await assetsDesign.run(ctx);
    const d = ctx.store.readJson("designs.json", Designs);
    expect(Object.keys(d.people)).toEqual(["teacher"]);
    expect(d.people.teacher?.name).toBe("Ms Park"); // id and name come from the script, not the designer
    expect(d.scores.teacher).toBe(8);
    expect(llm.calls.filter((c) => c.schemaName === "person").at(-1)?.user).toContain("looks like a waiter");
    expect(Object.keys(d.sets)).toEqual(["fixture-classroom"]);
    // the set that broke the geometry rules went back to the designer before anyone pictured it
    expect(llm.calls.filter((c) => c.schemaName === "set")[1]?.user).toMatch(/at least 4 spots/);
  });
  it("keeps the best design when none passes, and builds no set for a series or a narrator over graphics", async () => {
    const llm = new FakeLlm({
      person: { ...clerk },
      "design-gate": { recognizable: 5, defects: ["too plain"] },
    });
    const ctx = context(llm, { series: "s" });
    await assetsDesign.run(ctx);
    expect(ctx.store.readJson("designs.json", Designs).scores.teacher).toBe(5);
    expect(llm.calls.filter((c) => c.schemaName === "person")).toHaveLength(MAX_DESIGNS);
    expect(llm.calls.some((c) => c.schemaName === "scout")).toBe(false);
    const graphics = new FakeLlm({});
    await assetsDesign.run(context(graphics, {}, []));
    expect(graphics.calls).toHaveLength(0);
  });
});
