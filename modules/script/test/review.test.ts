import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Format, type Script, ScriptReview, type SeriesBible } from "@vf/contracts";
import { ArtifactStore, createLogger, FakeLlm, loadConfig, loadLibrary } from "@vf/core";
import type { StageContext } from "@vf/pipeline";
import { describe, expect, it } from "vitest";
import { better, type Critique, criteriaFor, missingCriteria, passes, UNIVERSAL } from "../src/domain/review.ts";
import type { ScriptDeps } from "../src/ports.ts";
import { scriptWrite } from "../src/stages/write.stage.ts";

const root = new URL("../../..", import.meta.url).pathname;
const library = loadLibrary(join(root, "library"));
const skit = library.formats.skit as Format;
const script = JSON.parse(readFileSync(join(root, "evals/fixtures/script.json"), "utf8")) as Script;
const premises = JSON.parse(readFileSync(join(root, "evals/fixtures/premises.json"), "utf8")) as unknown;

const critique = (score: number, failing: string[] = []): Critique => ({
  criteria: criteriaFor(skit).map((k) => ({ id: k.id, pass: !failing.includes(k.id), note: "n" })),
  score,
  summary: "s",
  fixes: failing.length ? `fix ${failing.join(", ")}` : "",
});

describe("script critic rules", () => {
  it("judges the shared criteria plus the format's rubric", () => {
    expect(criteriaFor(skit).map((k) => k.id)).toEqual([...UNIVERSAL, ...skit.rubric.map((r) => r.id)]);
    expect(missingCriteria({ ...critique(8), criteria: [] }, skit)).toHaveLength(criteriaFor(skit).length);
  });
  it("passes at score 7 with every must criterion, ignoring nice-to-haves", () => {
    expect(passes(critique(7), skit)).toBe(true);
    expect(passes(critique(9, ["speakable"]), skit)).toBe(false);
    expect(passes(critique(6), skit)).toBe(false);
    expect(passes(critique(8, ["loop"]), skit)).toBe(true); // loop is not a must for skits
  });
  it("prefers a passing draft, then the higher score", () => {
    expect(better(critique(7), critique(9, ["hook"]), skit)).toBe(true);
    expect(better(critique(8), critique(7), skit)).toBe(true);
  });
});

function context(llm: FakeLlm, params: Record<string, string>): StageContext<ScriptDeps> {
  return {
    runId: "t",
    seed: "t",
    store: new ArtifactStore(mkdtempSync(join(tmpdir(), "vf-write-"))),
    config: loadConfig(root),
    library,
    log: createLogger("error"),
    deps: { llm, downloader: undefined as never, transcriber: undefined as never },
    params,
    recordUsage: () => undefined,
  };
}

describe("script.write", () => {
  it("rewrites from the critic's fixes until the script passes, and records the verdict", async () => {
    const reviews = [critique(5, ["speakable"]), critique(8)];
    const llm = new FakeLlm({ premises, script, "script-review": () => reviews.shift() });
    const ctx = context(llm, { format: "skit" });
    await scriptWrite.run(ctx);
    expect(llm.calls.map((c) => c.schemaName)).toEqual([
      "premises",
      "script",
      "script-review",
      "script",
      "script-review",
    ]);
    expect(llm.calls[1]?.user).toContain("Fixture premise"); // the writer got the picked premise
    expect(llm.calls[3]?.user).toContain("fix speakable"); // the rewrite got the critic's notes
    const review = ctx.store.readJson("script-review.json", ScriptReview);
    expect(review).toMatchObject({ pass: true, score: 8, rounds: 2 });
  });
  it("stops after two rewrites and keeps the best draft, without blocking the episode", async () => {
    const scores = [6, 4, 5];
    const llm = new FakeLlm({ premises, script, "script-review": () => critique(scores.shift() ?? 0, ["hook"]) });
    const ctx = context(llm, { format: "skit" });
    await scriptWrite.run(ctx);
    expect(llm.calls.filter((c) => c.schemaName === "script-review")).toHaveLength(3);
    expect(ctx.store.readJson("script-review.json", ScriptReview)).toMatchObject({ pass: false, score: 6, rounds: 3 });
  });
  it("judges a rewrite of a recorded part as that part, without itself in the series history", async () => {
    const bible = {
      ...(library.series["night-diner"] ?? Object.values(library.series)[0]),
      id: "s",
      parts: [{ part: 1, title: "The Diner - Part 1", summary: "Recorded summary of part 1.", runId: "t" }],
    } as SeriesBible;
    const seriesFormat = library.formats.series as Format;
    const pass = {
      ...critique(8),
      criteria: criteriaFor(seriesFormat).map((k) => ({ id: k.id, pass: true, note: "n" })),
    };
    const llm = new FakeLlm({ script, "script-review": pass });
    const ctx = context(llm, { format: "series", series: "s" });
    ctx.library = { ...library, series: { ...library.series, s: bible } };
    ctx.store.writeJson("script.json", { ...script, part: 1 });
    await scriptWrite.run({ ...ctx, params: { format: "series", series: "s", note: "Sharper ending" } });
    const user = llm.calls[0]?.user ?? "";
    expect(user).toContain("this is PART 1");
    expect(user).not.toContain("Recorded summary of part 1");
  });
  it("only judges a script a human already edited, and rewrites it when the producer leaves a note", async () => {
    const llm = new FakeLlm({ script, "script-review": critique(8) });
    const ctx = context(llm, { format: "skit" });
    ctx.store.writeJson("script.json", script);
    await scriptWrite.run(ctx);
    expect(llm.calls.map((c) => c.schemaName)).toEqual(["script-review"]);
    await scriptWrite.run({ ...ctx, params: { format: "skit", note: "Làm đoạn kết bất ngờ hơn" } });
    expect(llm.calls.at(-2)?.user).toContain("<producer_note>\nLàm đoạn kết bất ngờ hơn");
  });
});
